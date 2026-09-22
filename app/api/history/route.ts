import { NextResponse } from 'next/server'
import { loadPair } from '@/components/site/PairBoard'
import { band, series, type Sample } from '@/lib/history'
import { chainSeries } from '@/lib/chain-history'

export const dynamic = 'force-dynamic'

/** Two thousand points is already more than the chart can draw distinctly. */
const MAX_SAMPLES = 2000

/**
 * The observed ratio series and its normal band.
 *
 * Two sources, same shape. The chain supplies the history — every swap on the
 * two pools recorded the price it executed at, and those events outlive any
 * process. The in-memory buffer supplies the last few minutes, which is finer
 * grained than the chain because it samples the quote feed whether or not
 * anyone traded.
 *
 * Loading the pair first means hitting this endpoint also contributes a live
 * sample, so the series keeps growing while someone is looking at it.
 */
export async function GET() {
  await loadPair()

  const [live, chain] = await Promise.all([
    Promise.resolve(series()),
    chainSeries(),
  ])

  const merged = combine(chain, live)

  return NextResponse.json({
    samples: merged,
    band: band(merged),
    source: chain.length > 0 ? 'chain+observed' : 'observed',
  })
}

/**
 * Chain history first, live samples after.
 *
 * Where the two overlap the live sample wins: it came from the quote feed
 * rather than from whatever size happened to trade, so it is the better
 * estimate of the mid at that moment.
 */
function combine(chain: Sample[], live: Sample[]): Sample[] {
  if (live.length === 0) return chain.slice(-MAX_SAMPLES)
  if (chain.length === 0) return live.slice(-MAX_SAMPLES)

  const cutoff = live[0].t
  const older = chain.filter((sample) => sample.t < cutoff)

  return [...older, ...live].slice(-MAX_SAMPLES)
}
