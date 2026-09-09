'use client'

import { useCallback, useRef, useState } from 'react'
import { parseUnits, type Address } from 'viem'
import { useAccount, useConfig } from 'wagmi'
import { readContract, signTypedData, waitForTransactionReceipt, writeContract } from 'wagmi/actions'
import { robinhoodChain } from '@/lib/chain'
import { TOKENS, erc20Abi, type TokenSymbol } from '@/lib/tokens'
import {
  ROUTER_ADDRESS,
  ROUTING_READY,
  classifyError,
  type TxPhase,
} from '@/lib/swap/execution'

const permitAbi = [
  {
    type: 'function',
    name: 'nonces',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

const DEADLINE_SECONDS = 20 * 60

export type StartArgs = {
  from: TokenSymbol
  amount: string
  /** Called once the run reaches a terminal phase, so callers can notify. */
  onSettled?: (phase: TxPhase) => void
}

/**
 * Drives a rotation from signature to receipt.
 *
 * The whole sequence is implemented; only the aggregator's spender and
 * calldata are missing, so `start` stops at a single, clearly-labelled point
 * when routing is not configured. Wiring that in does not change any state
 * below it.
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
    async ({ from, amount, onSettled }: StartArgs) => {
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

      if (!ROUTING_READY) {
        settle({ kind: 'failed', reason: 'router-not-configured' })
        return
      }

      const token = TOKENS[from]
      const spender = ROUTER_ADDRESS as Address
      const value = parseUnits(amount, token.decimals)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS)

      try {
        settle({ kind: 'permit' })

        const [name, nonce] = await Promise.all([
          readContract(config, {
            address: token.address,
            abi: permitAbi,
            functionName: 'name',
            chainId: robinhoodChain.id,
          }),
          readContract(config, {
            address: token.address,
            abi: permitAbi,
            functionName: 'nonces',
            args: [address],
            chainId: robinhoodChain.id,
          }),
        ])

        // The tokens expose DOMAIN_SEPARATOR() but not version(); '1' is the
        // EIP-2612 default. Before going live, compare the domain built here
        // against the contract's own separator and fall back to `approve` if
        // they disagree, rather than sending a signature that cannot verify.
        await signTypedData(config, {
          domain: {
            name: name as string,
            version: '1',
            chainId: robinhoodChain.id,
            verifyingContract: token.address,
          },
          types: PERMIT_TYPES,
          primaryType: 'Permit',
          message: {
            owner: address,
            spender,
            value,
            nonce: nonce as bigint,
            deadline,
          },
        })

        settle({ kind: 'swap' })

        // The routed quote carries the calldata to send here. Until it does,
        // the run cannot proceed past this point.
        const hash = await writeContract(config, {
          address: token.address,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, value],
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

        settle({ kind: 'confirmed', hash, received: null })
      } catch (error) {
        const { reason, detail } = classifyError(error)
        settle({ kind: 'failed', reason, detail })
      }
    },
    [address, config],
  )

  return { phase, start, reset }
}
