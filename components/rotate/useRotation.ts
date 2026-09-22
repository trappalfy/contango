'use client'

import { useCallback, useRef, useState } from 'react'
import { decodeEventLog, parseAbiItem, parseUnits, formatUnits, type Address, type Hex } from 'viem'
import { useAccount, useConfig } from 'wagmi'
import { readContract, sendTransaction, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { robinhoodChain } from '@/lib/chain'
import { TOKENS, erc20Abi, type TokenSymbol } from '@/lib/tokens'
import { classifyError, type TxPhase } from '@/lib/swap/execution'
import type { SwapPlan, SwapResponse } from '@/lib/swap/types'

const transferEvent = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
)

export type StartArgs = {
  from: TokenSymbol
  to: TokenSymbol
  amount: string
  /** Tolerance in percent, as the form presents it. */
  slippage: number
  /** The output the person was looking at when they committed, in tokens. */
  expectedOut: string | null
  /** Called once the run reaches a terminal phase, so callers can notify. */
  onSettled?: (phase: TxPhase) => void
}

/**
 * Drives a rotation from plan to receipt.
 *
 * The sequence is: ask the server for executable calldata, make sure the
 * aggregator's spender can move the input token, send the swap, then read back
 * what actually arrived rather than reporting what was promised.
 *
 * Allowance is granted for exactly the amount being rotated. An unlimited
 * approval would spare the occasional second signature, but it leaves a
 * standing claim on someone's position in a contract this app does not
 * control, and that is not a trade worth making for one click.
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
    async ({ from, to, amount, slippage, expectedOut, onSettled }: StartArgs) => {
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

      const token = TOKENS[from]
      const target = TOKENS[to]
      const value = parseUnits(amount, token.decimals)

      try {
        /* --- 1. the plan ------------------------------------------------ */
        settle({ kind: 'permit' })

        const response = await fetch('/api/swap', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from, to, amount, wallet: address, slippage }),
        })
        const payload = (await response.json()) as SwapResponse

        if (!payload.ok) {
          settle({
            kind: 'failed',
            reason: response.status === 501 ? 'router-not-configured' : 'unknown',
            detail: payload.error,
          })
          return
        }

        const plan: SwapPlan = payload.plan

        /* --- 1b. did the price move under them? -------------------------- */
        //
        // The quote on screen was priced seconds ago; this plan is priced now.
        // Slippage protects the transaction once it is sent, but it does not
        // protect someone from signing a materially worse trade than the one
        // they read. So the gap is checked before the wallet ever opens.
        if (expectedOut) {
          const promised = parseUnits(expectedOut, target.decimals)
          const actual = BigInt(plan.amountOut)
          const floor = promised - (promised * BigInt(Math.round(slippage * 100))) / 10_000n

          if (promised > 0n && actual < floor) {
            settle({
              kind: 'failed',
              reason: 'quote-moved',
              detail: `Quoted ${expectedOut}, routable ${formatUnits(actual, target.decimals)}.`,
            })
            return
          }
        }

        /* --- 2. allowance ----------------------------------------------- */
        const allowance = (await readContract(config, {
          address: token.address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [address, plan.spender],
          chainId: robinhoodChain.id,
        })) as bigint

        if (allowance < value) {
          settle({ kind: 'approve' })

          const approvalHash = await writeContract(config, {
            address: token.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [plan.spender, value],
            chainId: robinhoodChain.id,
          })

          settle({ kind: 'approve-pending', hash: approvalHash })

          const approval = await waitForTransactionReceipt(config, {
            hash: approvalHash,
            chainId: robinhoodChain.id,
          })

          if (approval.status === 'reverted') {
            settle({ kind: 'failed', reason: 'reverted', hash: approvalHash, detail: 'The approval reverted.' })
            return
          }
        }

        /* --- 3. the swap ------------------------------------------------ */
        settle({ kind: 'swap' })

        const hash = await sendTransaction(config, {
          to: plan.to,
          data: plan.data,
          value: BigInt(plan.value),
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

        /* --- 4. what actually arrived ------------------------------------ */
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
