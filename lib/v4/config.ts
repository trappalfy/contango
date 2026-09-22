import type { Address } from 'viem'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'

/**
 * Uniswap v4 on Robinhood Chain.
 *
 * Addresses are the official deployment for chain 4663, each one checked on
 * chain before it was written down. The PoolManager was found independently by
 * tracing which contract our tokens actually swap through, and it matches — so
 * these are not taken on trust from a document alone.
 *
 * Going straight to the protocol rather than through an aggregator means no
 * API key, no account, no rate limit and no third party that can go down. The
 * cost is that routing is ours to decide, which on this chain is not much of a
 * cost: there is exactly one viable pool per leg.
 */

export const V4 = {
  poolManager: '0x8366a39CC670B4001A1121B8F6A443A643e40951',
  universalRouter: '0x06AfBA43Fd06227fA663b0DAecF536f6EaA6bf99',
  quoter: '0x8Dc178eFB8111BB0973Dd9d722ebeFF267c98F94',
  permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
} as const satisfies Record<string, Address>

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

/**
 * The two pools that carry the volume, with the exact keys their `Initialize`
 * events recorded. Every other pool containing these tokens — and there are
 * tens of thousands — is dust or was never used.
 */
export const POOLS = {
  XOM: { fee: 2000, tickSpacing: 20, hooks: ZERO_ADDRESS },
  USO: { fee: 1200, tickSpacing: 15, hooks: ZERO_ADDRESS },
} as const

export type PathKey = {
  intermediateCurrency: Address
  fee: number
  tickSpacing: number
  hooks: Address
  hookData: `0x${string}`
}

/**
 * XOM and USO have no pool between them, so every rotation is two hops with
 * USDG in the middle. The path is expressed as the hops *after* the input
 * token, which is how v4 encodes it.
 */
export function rotationPath(from: TokenSymbol, to: TokenSymbol): PathKey[] {
  const leaving = POOLS[from as 'XOM' | 'USO']
  const arriving = POOLS[to as 'XOM' | 'USO']

  return [
    {
      intermediateCurrency: TOKENS.USDG.address,
      fee: leaving.fee,
      tickSpacing: leaving.tickSpacing,
      hooks: leaving.hooks,
      hookData: '0x',
    },
    {
      intermediateCurrency: TOKENS[to].address,
      fee: arriving.fee,
      tickSpacing: arriving.tickSpacing,
      hooks: arriving.hooks,
      hookData: '0x',
    },
  ]
}

/** The intermediate leg, for an interface that has to be honest about it. */
export const VIA = TOKENS.USDG.symbol

/** Venue name, for the route row. There is only one venue here. */
export const VENUE = 'Uniswap v4'
