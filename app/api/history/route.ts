import { NextResponse } from 'next/server'
import { loadPair } from '@/components/site/PairBoard'
import { band, series } from '@/lib/history'

export const dynamic = 'force-dynamic'

/**
 * The recorded ratio series and its normal band.
 *
 * Loading the pair first means hitting this endpoint also contributes a sample,
 * so the series grows whether someone is looking at the chart or the board.
 */
export async function GET() {
  await loadPair()

  const samples = series()
  return NextResponse.json({
    samples,
    band: band(samples),
    // Honest about where this came from: observed here, not sourced from a vendor.
    source: 'observed',
  })
}
