import { abs, bps, div, formatDec, formatMoney, mid, mul, parseDec, sub, type Dec } from './decimal'
import type { Asset, Quote } from './rh/schema'

/**
 * The XOM / USO pair.
 *
 * These are the only two oil-linked instruments on Robinhood Chain: an
 * integrated oil major, and a fund that holds crude futures. They track the
 * same barrel through completely different machinery, which is the whole
 * premise of the product.
 */
export const PAIR = {
  equity: {
    symbol: 'XOM',
    label: 'ExxonMobil',
    kind: 'Equity',
    mechanism: 'Sells the barrel. Earnings and a dividend, no futures to roll.',
  },
  fund: {
    symbol: 'USO',
    label: 'United States Oil Fund',
    kind: 'Futures fund',
    mechanism: 'Holds crude futures and must roll them forward every month.',
  },
} as const

export type Leg = {
  symbol: string
  label: string
  kind: string
  mechanism: string
  contract: string | null
  /** Raw underlying bid/ask, exactly as the REST feed returns it. */
  bid: Dec
  ask: Dec
  rawMid: Dec
  /** 1 token represents this many underlying shares. */
  multiplier: Dec
  /**
   * What one token is worth. The REST feed is NOT multiplier-adjusted while
   * the onchain Chainlink feed is, so this conversion is where the two
   * reconcile — and where a naive integration silently goes wrong.
   */
  tokenPrice: Dec
  spreadBps: number
  halted: boolean
  dailyHigh: Dec | null
  dailyLow: Dec | null
  generatedAt: string
  /** True once a split or dividend has moved the multiplier off 1.0. */
  hasCorporateAdjustment: boolean
}

export function buildLeg(
  spec: { symbol: string; label: string; kind: string; mechanism: string },
  asset: Asset | undefined,
  quote: Quote | undefined,
): Leg | null {
  if (!asset || !quote) return null

  const bid = parseDec(quote.bid)
  const ask = parseDec(quote.ask)
  const rawMid = mid(bid, ask)
  const multiplier = parseDec(asset.currentMultiplier)

  return {
    ...spec,
    contract: asset.deployments[0]?.contractAddress ?? null,
    bid,
    ask,
    rawMid,
    multiplier,
    tokenPrice: mul(rawMid, multiplier),
    spreadBps: bps(sub(ask, bid), rawMid),
    halted: quote.isTradingHalt,
    dailyHigh: quote.dailyHigh ? parseDec(quote.dailyHigh) : null,
    dailyLow: quote.dailyLow ? parseDec(quote.dailyLow) : null,
    generatedAt: quote.generatedAt,
    hasCorporateAdjustment: multiplier !== parseDec('1'),
  }
}

export type PairState = {
  equity: Leg
  fund: Leg
  /** How many USO tokens one XOM token is worth. The thing being traded. */
  ratio: Dec
  /** Cost of crossing both legs once, in basis points. */
  roundTripBps: number
  /** Neither leg is quoting - the exchange is closed or something is halted. */
  halted: boolean
}

export function buildPair(equity: Leg | null, fund: Leg | null): PairState | null {
  if (!equity || !fund) return null
  return {
    equity,
    fund,
    ratio: div(equity.tokenPrice, fund.tokenPrice),
    roundTripBps: equity.spreadBps + fund.spreadBps,
    halted: equity.halted || fund.halted,
  }
}

/** Where inside the session's range a price currently sits, 0..1. */
export function rangePosition(leg: Leg): number | null {
  if (!leg.dailyHigh || !leg.dailyLow) return null
  const span = sub(leg.dailyHigh, leg.dailyLow)
  if (span <= 0n) return null
  const offset = sub(leg.rawMid, leg.dailyLow)
  return Math.min(1, Math.max(0, Number(div(offset, span)) / 1e18))
}

export const fmt = { formatDec, formatMoney, abs }

/**
 * US equities trade 09:30-16:00 New York, Monday to Friday. The tokens keep
 * trading when that window is shut, which is exactly when the two legs stop
 * having an agreed reference price.
 */
export function marketSession(now = new Date()): {
  open: boolean
  label: string
  detail: string
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekday = get('weekday')
  const minutes = Number(get('hour')) * 60 + Number(get('minute'))

  const weekend = weekday === 'Sat' || weekday === 'Sun'
  const open = !weekend && minutes >= 9 * 60 + 30 && minutes < 16 * 60

  return {
    open,
    label: open ? 'NYSE open' : 'NYSE closed',
    detail: open
      ? 'Both legs price against a live market.'
      : weekend
        ? 'Until Monday the only reference is Friday’s close.'
        : 'Outside 09:30–16:00 New York the reference is the last close.',
  }
}
