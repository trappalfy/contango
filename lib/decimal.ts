/**
 * Fixed-point decimals for money.
 *
 * Prices arrive from Robinhood as decimal strings and corporate-action
 * multipliers are 18-decimal fixed point. Routing any of it through a JS
 * number loses precision silently, so every value here is a bigint scaled by
 * 1e18 and only formatted at the very edge, for display.
 */

export const SCALE = 18
const ONE = 10n ** BigInt(SCALE)

export type Dec = bigint

export const one = (): Dec => ONE

/** Parses "147.63" or "1.000566080061092436". Throws on anything else. */
export function parseDec(input: string): Dec {
  const trimmed = input.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`not a decimal: ${JSON.stringify(input)}`)
  }
  const negative = trimmed.startsWith('-')
  const body = negative ? trimmed.slice(1) : trimmed
  const [whole, fraction = ''] = body.split('.')

  // Extra precision beyond 18 places is truncated, never rounded up: this is
  // money, and silently inflating a value is worse than dropping a wisp of it.
  const padded = (fraction + '0'.repeat(SCALE)).slice(0, SCALE)
  const value = BigInt(whole) * ONE + BigInt(padded || '0')
  return negative ? -value : value
}

export const mul = (a: Dec, b: Dec): Dec => (a * b) / ONE
export const div = (a: Dec, b: Dec): Dec => {
  if (b === 0n) throw new Error('division by zero')
  return (a * ONE) / b
}
export const add = (a: Dec, b: Dec): Dec => a + b
export const sub = (a: Dec, b: Dec): Dec => a - b
export const abs = (a: Dec): Dec => (a < 0n ? -a : a)

/** Midpoint of a bid/ask pair. */
export const mid = (bid: Dec, ask: Dec): Dec => (bid + ask) / 2n

/** Formats with a fixed number of decimal places, half-up on the last digit. */
export function formatDec(value: Dec, places = 2): string {
  const negative = value < 0n
  let v = negative ? -value : value

  if (places < SCALE) {
    const cut = 10n ** BigInt(SCALE - places)
    const remainder = v % cut
    v = v / cut
    if (remainder * 2n >= cut) v += 1n
    v = v * cut
  }

  const whole = v / ONE
  const fraction = (v % ONE).toString().padStart(SCALE, '0').slice(0, places)
  const sign = negative ? '-' : ''
  return places === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`
}

/** Thousands separators, for prices and volumes shown to a reader. */
export function formatMoney(value: Dec, places = 2): string {
  const raw = formatDec(value, places)
  const [whole, fraction] = raw.split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const digits = sign ? whole.slice(1) : whole
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fraction ? `${sign}${grouped}.${fraction}` : `${sign}${grouped}`
}

/** Basis points of `part` relative to `whole`. */
export function bps(part: Dec, whole: Dec): number {
  if (whole === 0n) return 0
  return Number((part * 10000n * 100n) / whole) / 100
}

/** Only for chart geometry and other places where a float is genuinely fine. */
export const toNumber = (value: Dec): number => Number(value) / Number(ONE)
