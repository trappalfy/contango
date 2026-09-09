import { toNumber, type Dec } from './decimal'

/**
 * Ratio history.
 *
 * Robinhood's feed has no history in it, and no market-data provider sells the
 * overnight and weekend hours when these tokens keep trading and the exchange
 * does not. So the only way to own that series is to record it.
 *
 * This is a process-local ring buffer: real observations, but they die with the
 * server. Production needs a table — the shape below is deliberately the shape
 * of a row, so moving it to Postgres is a swap of `push` and `series`.
 */
export type Sample = {
  /** Unix milliseconds. */
  t: number
  /** XOM per USO, as observed. */
  ratio: number
  /** Round-trip spread at the time, in basis points. */
  spreadBps: number
  /** Whether the US market was open when this was taken. */
  open: boolean
}

const MAX_SAMPLES = 2000
/**
 * Matched to the quote cache TTL. Sampling slower than the feed refreshes
 * throws away resolution we already paid for; sampling faster just records the
 * same cached numbers twice.
 */
const MIN_INTERVAL_MS = 20_000

const buffer: Sample[] = []

export function record(ratio: Dec, spreadBps: number, open: boolean, now = Date.now()): void {
  const last = buffer[buffer.length - 1]
  if (last && now - last.t < MIN_INTERVAL_MS) return

  buffer.push({ t: now, ratio: toNumber(ratio), spreadBps, open })
  if (buffer.length > MAX_SAMPLES) buffer.splice(0, buffer.length - MAX_SAMPLES)
}

export function series(): Sample[] {
  return buffer.slice()
}

export type Band = {
  mean: number
  sd: number
  /** Where the latest sample sits, in standard deviations from the mean. */
  z: number | null
  count: number
}

/**
 * Mean and spread of the observed ratio.
 *
 * Reported only once there are enough samples to mean anything — a band drawn
 * from four points is worse than no band, because it looks authoritative.
 */
export const MIN_SAMPLES_FOR_BAND = 20

export function band(samples: Sample[]): Band | null {
  if (samples.length < MIN_SAMPLES_FOR_BAND) return null

  const values = samples.map((s) => s.ratio)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const sd = Math.sqrt(variance)
  const latest = values[values.length - 1]

  return {
    mean,
    sd,
    z: sd > 0 ? (latest - mean) / sd : null,
    count: samples.length,
  }
}
