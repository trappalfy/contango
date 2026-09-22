'use client'

import { useCallback, useRef, useState } from 'react'
import {
  decodeEventLog,
  formatUnits,
  maxUint256,
  parseAbiItem,
  parseUnits,
  type Address,
  type Hex,
} from 'viem'
import { useAccount, useConfig } from 'wagmi'
import {
  readContract,
  sendTransaction,
  signTypedData,
  waitForTransactionReceipt,
  writeContract,
} from 'wagmi/actions'
import { robinhoodChain } from '@/lib/chain'
import { TOKENS, erc20Abi, type TokenSymbol } from '@/lib/tokens'
import { classifyError, type TxPhase } from '@/lib/swap/execution'
import { V4 } from '@/lib/v4/config'
import {
  MAX_UINT160,
  buildPermitSingle,
  buildRotationCall,
  permit2Abi,
  permit2Domain,
  permit2Types,
} from '@/lib/v4/router'

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

/** A permit with less than this left to run is treated as spent. */
const EXPIRY_MARGIN_SECONDS = 5 * 60

export type StartArgs = {
  from: TokenSymbol
  to: TokenSymbol
  amount: string
  /** Tolerance in percent, as the form presents it. */
  slippage: number
  /** Quoted output in base units, from the routed quote on screen. */
  expectedOutWei: string | null
  /** Called once the run reaches a terminal phase, so callers can notify. */
  onSettled?: (phase: TxPhase) => void
}

/**
 * Drives a rotation from quote to receipt.
 *
 * Tokens reach the router through Permit2, which splits permission in two: a
 * single lifetime approval from the token to Permit2, then a signature naming
 * the router. The approval is a transaction and happens once ever; the
 * signature is free, lasts thirty days, and travels inside the swap. So the
 * first rotation costs two sends and every one after it costs one.
 *
 * Nothing is built on the server. The calldata is pure encoding over public
 * addresses, so it is assembled here where it can be read.
 */
export function useRotation() {
  const [phase, setPhase] = useState<TxPhase>({ kind: 'idle' })
  const config = useConfig()
  const { address } = useAccount()
  const runId = useRef(0)

  const reset = useCallback(() => {
    runId.current++
    setPhase({ kind: 'idle' })
  }, [])

  const start = useCallback(
    async ({ from, to, amount, slippage, expectedOutWei, onSettled }: StartArgs) => {
      const id = ++runId.current
      const settle = (next: TxPhase) => {
        // A cancelled or superseded run must never write over a newer one.
        if (id !== runId.current) return
        setPhase(next)
        if (next.kind === 'confirmed' || next.kind === 'failed') onSettled?.(next)
      }

      if (!address) {
        settle({ kind: 'failed', reason: 'unknown', detail: 'No account connected.' })
        return
      }
      if (!expectedOutWei) {
        settle({ kind: 'failed', reason: 'unknown', detail: 'No routed quote to execute.' })
        return
      }

      const token = TOKENS[from]
      const target = TOKENS[to]
      const amountIn = parseUnits(amount, token.decimals)
      const quoted = BigInt(expectedOutWei)
      const minOut = quoted - (quoted * BigInt(Math.round(slippage * 100))) / 10_000n

      try {
        /* --- 1. the token must trust Permit2, once ever ------------------ */
        settle({ kind: 'permit' })

        const tokenAllowance = (await readContract(config, {
          address: token.address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, V4.permit2 as Address],
          chainId: robinhoodChain.id,
        })) as bigint

        if (tokenAllowance < amountIn) {
          settle({ kind: 'approve' })

          const approvalHash = await writeContract(config, {
            address: token.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [V4.permit2 as Address, maxUint256],
            chainId: robinhoodChain.id,
          })

          settle({ kind: 'approve-pending', hash: approvalHash })

          const approval = await waitForTransactionReceipt(config, {
            hash: approvalHash,
            chainId: robinhoodChain.id,
          })

          if (approval.status === 'reverted') {
            settle({
              kind: 'failed',
              reason: 'reverted',
              hash: approvalHash,
              detail: 'The approval to Permit2 reverted.',
            })
            return
          }
        }

        /* --- 2. Permit2 must name the router ---------------------------- */
        const [permitAmount, expiration, nonce] = (await readContract(config, {
          address: V4.permit2 as Address,
          abi: permit2Abi,
          functionName: 'allowance',
          args: [address, token.address, V4.universalRouter as Address],
          chainId: robinhoodChain.id,
        })) as [bigint, number, number]

        const now = Math.floor(Date.now() / 1000)
        const standing =
          permitAmount >= amountIn && Number(expiration) > now + EXPIRY_MARGIN_SECONDS

        let permit: { single: ReturnType<typeof buildPermitSingle>; signature: Hex } | undefined

        if (!standing) {
          const single = buildPermitSingle(token.address, Number(nonce))
          const signature = await signTypedData(config, {
            domain: permit2Domain,
            types: permit2Types,
            primaryType: 'PermitSingle',
            message: single,
          })
          permit = { single, signature }
        }

        /* --- 3. the swap ------------------------------------------------ */
        settle({ kind: 'swap' })

        const call = buildRotationCall({ from, to, amountIn, minAmountOut: minOut, permit })

        const hash = await sendTransaction(config, {
          to: call.to,
          data: call.data,
          value: call.value,
          chainId: robinhoodChain.id,
        })

        settle({ kind: 'pending', hash })

        const receipt = await waitForTransactionReceipt(config, {
          hash,
          chainId: robinhoodChain.id,
        })

        if (receipt.status === 'reverted') {
          settle({ kind: 'failed', reason: 'reverted', hash })
          return
        }

        /* --- 4. what actually arrived ----------------------------------- */
        settle({
          kind: 'confirmed',
          hash,
          received: receivedAmount(receipt.logs, target.address, address, target.decimals),
        })
      } catch (error) {
        const { reason, detail } = classifyError(error)
        settle({ kind: 'failed', reason, detail })
      }
    },
    [address, config],
  )

  return { phase, start, reset }
}

/**
 * Reads the credited amount out of the receipt.
 *
 * Reporting the quote back as though it were the fill is how an interface ends
 * up lying by a few basis points every time. The transfer into the wallet is
 * the only number that happened.
 */
function receivedAmount(
  logs: readonly { address: string; topics: readonly string[]; data: string }[],
  token: Address,
  wallet: Address,
  decimals: number,
): string | null {
  let total = 0n

  for (const log of logs) {
    if (log.address.toLowerCase() !== token.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: [transferEvent],
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      })
      if (decoded.args.to.toLowerCase() === wallet.toLowerCase()) {
        total += decoded.args.value
      }
    } catch {
      // Not a Transfer, or not one this ABI can read. Skip it.
    }
  }

  return total > 0n ? formatUnits(total, decimals) : null
}

export { MAX_UINT160 }
