import type { TokenSymbol } from '@/lib/tokens'

export type RotationDirection = {
  from: TokenSymbol
  to: TokenSymbol
}

/**
 * A rotation quote.
 *
 * `source` is the honest part: `indicative` is arithmetic on the mid prices
 * from Robinhood's feed, which is what this build can produce. `routed` means
 * an aggregator actually priced the swap against real pool liquidity, which
 * needs an API key and is the one thing left to wire up.
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
  /** Mid-price ratio used, 18-decimal fixed point as a decimal string. */
  ratio: string
  /** Half-spread on each leg, the unavoidable cost of crossing. */
  spreadBps: number
  /** Only present on routed quotes. */
  priceImpactBps?: number
  route?: string[]
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

/** Whether aggregator routing is configured for this deployment. */
export const ROUTING_CONFIGURED = Boolean(process.env.ONEINCH_API_KEY)
