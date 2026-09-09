'use client'

import { useMemo } from 'react'
import { useAccount, useReadContracts } from 'wagmi'
import { erc20Abi, scaledTokenAbi, TOKENS, TRACKED, type TokenSymbol } from '@/lib/tokens'
import { robinhoodChain } from '@/lib/chain'

export type TokenBalance = {
  symbol: TokenSymbol
  /** Raw ERC-20 balance, in the token's own decimals. */
  raw: bigint
  decimals: number
  /**
   * ERC-8056 multiplier, 18-decimal fixed point. One token represents this
   * many underlying shares. Stock tokens only; stables have no multiplier.
   */
  multiplier: bigint | null
}

export type BalancesState = {
  balances: Record<TokenSymbol, TokenBalance> | null
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

const MULTIPLIER_ONE = 10n ** 18n

/**
 * Reads every tracked balance, and the corporate-action multiplier for the
 * stock tokens, in one multicall.
 *
 * The multiplier read is allowed to fail: a token that does not implement
 * ERC-8056 simply has no adjustment, and treating that as an error would take
 * the whole panel down over an optional call.
 */
export function useBalances(): BalancesState {
  const { address, isConnected, chainId } = useAccount()
  const onRightChain = chainId === robinhoodChain.id

  const contracts = useMemo(() => {
    if (!address) return []
    const calls = TRACKED.map((symbol) => ({
      address: TOKENS[symbol].address,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address] as const,
      chainId: robinhoodChain.id,
    }))
    const multipliers = TRACKED.filter((s) => TOKENS[s].kind === 'stock').map((symbol) => ({
      address: TOKENS[symbol].address,
      abi: scaledTokenAbi,
      functionName: 'uiMultiplier' as const,
      chainId: robinhoodChain.id,
    }))
    return [...calls, ...multipliers]
  }, [address])

  const query = useReadContracts({
    contracts,
    allowFailure: true,
    query: { enabled: Boolean(address) && isConnected && onRightChain },
  })

  const balances = useMemo(() => {
    if (!query.data || !address) return null

    const stockSymbols = TRACKED.filter((s) => TOKENS[s].kind === 'stock')
    const out = {} as Record<TokenSymbol, TokenBalance>

    TRACKED.forEach((symbol, i) => {
      const result = query.data[i]
      const multiplierIndex = stockSymbols.indexOf(symbol)
      const multiplierResult =
        multiplierIndex >= 0 ? query.data[TRACKED.length + multiplierIndex] : undefined

      out[symbol] = {
        symbol,
        raw: result?.status === 'success' ? (result.result as bigint) : 0n,
        decimals: TOKENS[symbol].decimals,
        multiplier:
          multiplierResult?.status === 'success'
            ? (multiplierResult.result as bigint)
            : TOKENS[symbol].kind === 'stock'
              ? MULTIPLIER_ONE
              : null,
      }
    })

    return out
  }, [query.data, address])

  return {
    balances,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => void query.refetch(),
  }
}

/** Formats a raw balance for display without going through a float. */
export function formatUnitsFixed(raw: bigint, decimals: number, places = 4): string {
  const negative = raw < 0n
  const value = negative ? -raw : raw
  const base = 10n ** BigInt(decimals)
  const whole = value / base

  let fraction = ''
  if (places > 0) {
    const scaled = (value % base) * 10n ** BigInt(places)
    fraction = '.' + (scaled / base).toString().padStart(places, '0')
  }

  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${negative ? '-' : ''}${grouped}${fraction}`
}
