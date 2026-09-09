import type { z } from 'zod'
import {
  assetsResponseSchema,
  corpActionsResponseSchema,
  pricesResponseSchema,
  type Asset,
  type CorpAction,
  type Quote,
} from './schema'

const BASE = 'https://api.robinhood.com/rhj'

/**
 * Robinhood's public read-only endpoints, with the caching they demand.
 *
 * The documented limit is 60 req/s, but in practice a second call within a
 * couple of seconds comes back `429 local_rate_limited`. Everything here is
 * therefore served from a process-local cache, requests in flight are shared
 * rather than duplicated, and a failed refresh falls back to the last good
 * value instead of taking the page down.
 *
 * Server-side only — never import this into a client component.
 */

type Entry<T> = { value: T; fetchedAt: number }

const cache = new Map<string, Entry<unknown>>()
const inFlight = new Map<string, Promise<unknown>>()

export type Fetched<T> = {
  data: T
  /** When the underlying request actually succeeded. */
  fetchedAt: number
  /** True when a refresh failed and this is the previous good value. */
  stale: boolean
}

async function cached<T>(
  key: string,
  path: string,
  schema: z.ZodType<T>,
  ttlMs: number,
): Promise<Fetched<T>> {
  const hit = cache.get(key) as Entry<T> | undefined
  const now = Date.now()

  if (hit && now - hit.fetchedAt < ttlMs) {
    return { data: hit.value, fetchedAt: hit.fetchedAt, stale: false }
  }

  const existing = inFlight.get(key) as Promise<Fetched<T>> | undefined
  if (existing) return existing

  const request = (async (): Promise<Fetched<T>> => {
    try {
      const response = await fetch(`${BASE}${path}`, {
        headers: { accept: 'application/json' },
        // Caching is handled here so the behaviour is identical in dev and prod.
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })

      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)

      const parsed = schema.safeParse(await response.json())
      if (!parsed.success) {
        throw new Error(`unexpected shape: ${parsed.error.issues[0]?.message ?? 'unknown'}`)
      }

      cache.set(key, { value: parsed.data, fetchedAt: Date.now() })
      return { data: parsed.data, fetchedAt: Date.now(), stale: false }
    } catch (error) {
      if (hit) {
        // Rate limited or the upstream blipped. Last good data beats an error page.
        return { data: hit.value, fetchedAt: hit.fetchedAt, stale: true }
      }
      throw error
    } finally {
      inFlight.delete(key)
    }
  })()

  inFlight.set(key, request)
  return request
}

/** Every listed stock token, with its contract address and current multiplier. */
export async function getAssets(): Promise<Fetched<Asset[]>> {
  const result = await cached('assets', '/assets', assetsResponseSchema, 60 * 60 * 1000)
  return { ...result, data: result.data.assets }
}

/**
 * All quotes in a single request. `/prices/{symbol}` exists but costs one
 * request per symbol, and the rate limit does not tolerate that.
 */
export async function getQuotes(): Promise<Fetched<Quote[]>> {
  const result = await cached('prices', '/prices', pricesResponseSchema, 20 * 1000)
  return { ...result, data: result.data.quotes }
}

export async function getCorpActions(): Promise<Fetched<CorpAction[]>> {
  const result = await cached(
    'corp-actions',
    '/corporate-actions',
    corpActionsResponseSchema,
    60 * 60 * 1000,
  )
  return { ...result, data: result.data.corpActions }
}

export const findBySymbol = <T extends { tokenSymbol: string }>(
  rows: T[],
  symbol: string,
): T | undefined => rows.find((row) => row.tokenSymbol === symbol)
