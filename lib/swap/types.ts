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

/**
 * The executable half: everything needed to put a rotation on chain.
 *
 * Kept separate from the quote because it costs a second aggregator call, is
 * specific to one wallet, and goes stale in seconds — so it is fetched when
 * someone commits, not while they are still typing.
 */
export type SwapPlan = {
  /** The contract to permit and to send the transaction to. */
  spender: `0x${string}`
  to: `0x${string}`
  data: `0x${string}`
  value: string
  gas?: number
  /** Expected output in base units, before slippage. */
  amountOut: string
  /** The least the swap may deliver before it reverts, in base units. */
  minAmountOut: string
  route: string[]
  hops: number
  slippage: number
}

export type SwapResponse =
  | { ok: true; plan: SwapPlan }
  | { ok: false; error: string }
