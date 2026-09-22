import type { z } from 'zod'
import { robinhoodChain } from '@/lib/chain'
import {
  allowanceSchema,
  errorSchema,
  quoteSchema,
  spenderSchema,
  swapSchema,
  type OneInchQuote,
  type OneInchSwap,
} from './schema'

/**
 * 1inch Swap API v6.1, on Robinhood Chain.
 *
 * 1inch has supported chain 4663 since July 2026, so the chain id goes in the
 * path and an ordinary key works. Server-side only — the key must never reach
 * a browser, which is why every call here is made from a route handler.
 *
 * Two constraints shape this file:
 *
 * 1. The free tier is one request a second. Every call therefore passes
 *    through a single serialising queue with a minimum gap, and results are
 *    cached and shared between concurrent callers, exactly as `lib/rh/client`
 *    does for Robinhood's feed.
 * 2. A swap response is only good for a few seconds and is specific to one
 *    wallet, so it is cached briefly and keyed by every parameter that went
 *    into it.
 */

/**
 * 1inch is mid-migration between two gateways.
 *
 * `api.1inch.com` is what the current portal documents; `api.1inch.dev` is the
 * older host and still answers. Both are live and they fail differently when
 * unauthenticated (402 against one, 401 against the other), so which one a
 * given key belongs to cannot be settled from the outside.
 *
 * Rather than guess, the first call tries the documented host and, if that
 * rejects the key outright, tries the other one once. Whichever answers
 * becomes sticky for the life of the process. `ONEINCH_BASE_URL` overrides the
 * order entirely for a deployment that knows better.
 */
const DOCUMENTED = 'https://api.1inch.com'
const LEGACY = 'https://api.1inch.dev'
const VERSION = 'swap/v6.1'

const override = process.env.ONEINCH_BASE_URL?.trim().replace(/\/$/, '')
const HOSTS = override ? [override] : [DOCUMENTED, LEGACY]

/** Statuses that mean "wrong gateway or wrong credentials", not "bad request". */
const GATEWAY_REJECTIONS = new Set([401, 402, 403, 404])

let activeHost: string | null = null

const CHAIN = robinhoodChain.id

/** Free tier is 1 rps; leave a margin so a burst does not earn a 429. */
const MIN_GAP_MS = 1100

const QUOTE_TTL_MS = 10_000
/** Calldata ages out fast. Long enough to absorb a double click, no longer. */
const SWAP_TTL_MS = 4_000
/** The router address changes about never. */
const SPENDER_TTL_MS = 60 * 60 * 1000

export const ONEINCH_KEY = process.env.ONEINCH_API_KEY?.trim() ?? ''
export const ROUTING_CONFIGURED = ONEINCH_KEY.length > 0

export class OneInchError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'OneInchError'
  }
}

/* ------------------------------------------------------------------ */
/* Rate limiting                                                       */
/* ------------------------------------------------------------------ */

let chain: Promise<unknown> = Promise.resolve()
let lastStart = 0

/** Runs `task` after the minimum gap since the previous request began. */
function serialise<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastStart)
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    lastStart = Date.now()
    return task()
  })
  // Keep the chain alive even when a call rejects, or one failure stalls
  // every request that follows it.
  chain = run.catch(() => undefined)
  return run
}

/* ------------------------------------------------------------------ */
/* Cache                                                               */
/* ------------------------------------------------------------------ */

type Entry = { value: unknown; at: number }

const cache = new Map<string, Entry>()
const inFlight = new Map<string, Promise<unknown>>()

async function get<T>(
  path: string,
  params: Record<string, string>,
  schema: z.ZodType<T>,
  ttlMs: number,
): Promise<T> {
  if (!ROUTING_CONFIGURED) {
    throw new OneInchError('ONEINCH_API_KEY is not set on this deployment.', 501)
  }

  const query = new URLSearchParams(params).toString()
  const key = `${path}?${query}`

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T

  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return existing

  const request = serialise(async () => {
    // Once a host has answered, stop shopping around.
    const candidates = activeHost ? [activeHost] : HOSTS
    let lastRejection: OneInchError | null = null
    let body: unknown = null
    let host: string | null = null

    for (const candidate of candidates) {
      const response = await fetch(`${candidate}/${VERSION}/${CHAIN}${path}?${query}`, {
        headers: { accept: 'application/json', authorization: `Bearer ${ONEINCH_KEY}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      })

      const payload: unknown = await response.json().catch(() => null)

      if (response.ok) {
        body = payload
        host = candidate
        break
      }

      const parsed = errorSchema.safeParse(payload)
      const detail = parsed.success ? (parsed.data.description ?? parsed.data.error ?? '') : ''
      const failure = new OneInchError(
        detail || `${response.status} ${response.statusText}`,
        response.status,
      )

      // A rate limit or a server fault is not a reason to try a different
      // gateway — the same thing will happen there, and it would double the
      // load on a budget that is already one request a second.
      if (!GATEWAY_REJECTIONS.has(response.status)) throw failure
      lastRejection = failure
    }

    if (host === null) {
      throw (
        lastRejection ??
        new OneInchError('No 1inch gateway accepted the request.', 502)
      )
    }

    activeHost = host

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      throw new OneInchError(
        `unexpected response shape: ${parsed.error.issues[0]?.message ?? 'unknown'}`,
        502,
      )
    }

    cache.set(key, { value: parsed.data, at: Date.now() })
    return parsed.data
  }).finally(() => {
    inFlight.delete(key)
  })

  inFlight.set(key, request)
  return request
}

/* ------------------------------------------------------------------ */
/* Endpoints                                                           */
/* ------------------------------------------------------------------ */

/**
 * Price only — no wallet involved, so this is what the form can poll while
 * someone is still typing.
 */
export function fetchQuote(args: {
  src: string
  dst: string
  amount: string
}): Promise<OneInchQuote> {
  return get(
    '/quote',
    {
      src: args.src,
      dst: args.dst,
      amount: args.amount,
      includeProtocols: 'true',
      includeGas: 'true',
    },
    quoteSchema,
    QUOTE_TTL_MS,
  )
}

/**
 * The executable form: same pricing plus the transaction to send.
 *
 * `disableEstimate` is on because 1inch estimates gas by simulating against
 * the caller's balance and allowance, and the allowance is granted in the
 * transaction immediately before this one. Simulating would fail for a reason
 * that will not exist by the time the swap is sent.
 */
export function fetchSwap(args: {
  src: string
  dst: string
  amount: string
  from: string
  slippage: number
}): Promise<OneInchSwap> {
  return get(
    '/swap',
    {
      src: args.src,
      dst: args.dst,
      amount: args.amount,
      from: args.from,
      slippage: String(args.slippage),
      includeProtocols: 'true',
      disableEstimate: 'true',
    },
    swapSchema,
    SWAP_TTL_MS,
  )
}

/** The address that has to hold the allowance. Never hardcoded. */
export async function fetchSpender(): Promise<`0x${string}`> {
  const { address } = await get('/approve/spender', {}, spenderSchema, SPENDER_TTL_MS)
  return address
}

export async function fetchAllowance(args: {
  token: string
  wallet: string
}): Promise<bigint> {
  const { allowance } = await get(
    '/approve/allowance',
    { tokenAddress: args.token, walletAddress: args.wallet },
    allowanceSchema,
    0,
  )
  return BigInt(allowance)
}

/* ------------------------------------------------------------------ */
/* Route presentation                                                  */
/* ------------------------------------------------------------------ */

/**
 * Flattens 1inch's three-deep protocol array into the venue names, in order.
 *
 * There is no direct XOM/USO pool on this chain — verified against every
 * `Initialize` event the PoolManager has ever emitted — so a rotation is
 * always at least two hops, and the interface has to be able to say so.
 */
export function routeNames(protocols: OneInchQuote['protocols']): string[] {
  if (!protocols) return []
  const names: string[] = []
  for (const split of protocols) {
    for (const path of split) {
      for (const hop of path) {
        if (!names.includes(hop.name)) names.push(hop.name)
      }
    }
  }
  return names
}

/** How many hops the longest path takes; 2 means it went through USDG. */
export function routeHops(protocols: OneInchQuote['protocols']): number {
  if (!protocols) return 0
  return Math.max(0, ...protocols.map((split) => Math.max(0, ...split.map((path) => path.length))))
}
