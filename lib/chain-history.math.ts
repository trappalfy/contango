/**
 * The arithmetic between a swap event and a point on the chart.
 *
 * Deliberately free of imports: this is the part worth testing, and it has no
 * business depending on an RPC client to be exercised. `./chain-history` does
 * the fetching and calls into here.
 */

export type PricePoint = { t: number; price: number }

/**
 * USDG per token, from a pool's square-root price.
 *
 * currency0 is USDG at six decimals and currency1 is the stock token at
 * eighteen, so the raw ratio has to be shifted by the twelve decimal places
 * between them. Getting that shift wrong is an error of a factor of a million,
 * which is precisely why it is tested.
 */
export function priceFrom(sqrtPriceX96: bigint): number {
  const sqrt = Number(sqrtPriceX96) / 2 ** 96
  if (!Number.isFinite(sqrt) || sqrt === 0) return 0
  return 1e12 / (sqrt * sqrt)
}

/**
 * Pairs the two price series into ratio points.
 *
 * The legs do not trade at the same instants, so each XOM print is matched to
 * the most recent USO print at or before it. Carrying the last known price
 * forward is what a mid is: a quote stands until something replaces it. An XOM
 * print with nothing behind it is dropped rather than priced against a quote
 * from the future, which would invent history.
 */
export function join(xom: PricePoint[], uso: PricePoint[]): PricePoint[] {
  if (xom.length === 0 || uso.length === 0) return []

  const sorted = [...uso].sort((a, b) => a.t - b.t)
  const out: PricePoint[] = []
  let cursor = 0
  let last: number | null = null

  for (const point of [...xom].sort((a, b) => a.t - b.t)) {
    while (cursor < sorted.length && sorted[cursor].t <= point.t) {
      last = sorted[cursor].price
      cursor++
    }
    if (last != null && last > 0) out.push({ t: point.t, price: point.price / last })
  }

  return out
}
