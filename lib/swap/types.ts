import type { TokenSymbol } from '@/lib/tokens'

export type RotationDirection = {
  from: TokenSymbol
  to: TokenSymbol
}

/**
 * A rotation quote.
 *
 * `indicative` is arithmetic on the mid prices from Robinhood's feed: real
 * live prices, but it charges only the quoted spread and knows nothing about
 * pool depth. `routed` means 1inch priced the swap against the liquidity that
 * actually exists, which is the only number anyone should trade on.
 *
 * The difference is not cosmetic. There is no XOM/USO pool on Robinhood Chain,
 * so every rotation crosses two pools via USDG and pays both their fees on top
 * of the impact. An indicative quote understates the real cost several times
 * over, which is why the interface must never present one as executable.
 */
export type QuoteSource = 'indicative' | 'routed'

export type RotationQuote = {
  source: QuoteSource
  from: TokenSymbol
  to: TokenSymbol
  /** Input, in the from-token's own decimals. */
  amountIn: string
  /** Expected output, in the to-token's own decimals. */
  amountOut: string
  /** The same figure in base units, which is what slippage is applied to. */
  amountOutWei?: string
  /** Mid-price ratio used, as a decimal string. */
  ratio: string
  /** Half-spread on each leg, the unavoidable cost of crossing. */
  spreadBps: number
  /**
   * How far the routed output falls short of the mid-price value of the
   * input: pool fees and depth together, in basis points. Routed quotes only.
   */
  priceImpactBps?: number
  /** Venue names in path order, e.g. ["UNISWAP_V4"]. */
  route?: string[]
  /** Hops in the longest path. Two means it went through USDG. */
  hops?: number
  /** The intermediate leg, when the route is not direct. */
  via?: string
  /** Gas the aggregator expects the swap to burn. */
  estimatedGas?: number
  /** Why a routed quote was not available. */
  note?: string
}

export type QuoteResponse =
  | { ok: true; quote: RotationQuote }
  | { ok: false; error: string }

export type QuoteRequest = {
  from: TokenSymbol
  to: TokenSymbol
  /** Human-entered amount, e.g. "12.5". */
  amount: string
}

