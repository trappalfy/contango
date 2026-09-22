import { createPublicClient, http } from 'viem'
import { robinhoodChain } from './chain'
import { join, priceFrom, type PricePoint } from './chain-history.math'
import type { Sample } from './history'

/**
 * Ratio history, read back off the chain instead of remembered.
 *
 * The in-process buffer in `./history` records what this server has seen since
 * it started. That is honest but fragile: on a serverless host the memory is
 * per-instance and empty after every cold start, so the band — which needs
 * twenty samples — would essentially never appear.
 *
 * The chain does not have that problem. Every swap on the two pools carries
 * the price it executed at, so the series can be reconstructed from events
 * that are already there and will still be there tomorrow. No database, no
 * vendor, and it reaches back days rather than minutes.
 *
 * There is no XOM/USO pool, so neither leg is priced against the other
 * directly. Both are priced in USDG and the ratio is the quotient — which is
 * exactly what the rotation actually does.
 */

const POOL_MANAGER = '0x8366a39cc670b4001a1121b8f6a443a643e40951' as const

/**
 * The two pools that carry real volume, found by counting swaps across every
 * pool either token appears in. The rest are dust or were never used.
 */
const POOLS = {
  /** USDG/XOM, 0.20% — the only XOM pool with sustained volume. */
  XOM: '0xb3d129708f216d47fd3f996bc9dd0365912e6f14f961e0c61de76a0c1deef074',
  /** USDG/USO, 0.12% — an order of magnitude busier than the XOM side. */
  USO: '0x1f2ad5a274a776d8e1408292bde1d92d8fa7b6444acf14ad60b9c3e4e5b66420',
} as const

/**
 * Written out rather than parsed from a signature string: viem only infers the
 * indexed-argument filter — which is what makes a per-pool query cheap — from
 * an ABI it can see the shape of.
 */
const swapEvent = {
  type: 'event',
  name: 'Swap',
  inputs: [
    { name: 'id', type: 'bytes32', indexed: true },
    { name: 'sender', type: 'address', indexed: true },
    { name: 'amount0', type: 'int128', indexed: false },
    { name: 'amount1', type: 'int128', indexed: false },
    { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
    { name: 'liquidity', type: 'uint128', indexed: false },
    { name: 'tick', type: 'int24', indexed: false },
    { name: 'fee', type: 'uint24', indexed: false },
  ],
} as const

/** ~3.5 days at this chain's tenth-of-a-second blocks. */
const LOOKBACK_BLOCKS = 3_000_000n
/** The node caps a single query at 10,000 logs; these pools are far quieter. */
const CHUNK = 1_000_000n

const client = createPublicClient({ chain: robinhoodChain, transport: http() })


async function poolPrices(
  poolId: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<PricePoint[]> {
  const points: PricePoint[] = []

  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = start + CHUNK - 1n > toBlock ? toBlock : start + CHUNK - 1n

    try {
      const logs = await client.getLogs({
        address: POOL_MANAGER,
        event: swapEvent,
        args: { id: poolId },
        fromBlock: start,
        toBlock: end,
      })

      for (const log of logs) {
        const sqrtPriceX96 = log.args.sqrtPriceX96
        if (sqrtPriceX96 == null || log.blockNumber == null) continue
        const price = priceFrom(sqrtPriceX96)
        if (price > 0) points.push({ t: Number(log.blockNumber), price })
      }
    } catch {
      // A chunk that fails is a gap in the series, not a reason to lose the
      // rest of it.
    }
  }

  return points
}

let cached: { samples: Sample[]; at: number } | null = null
/** Reading days of logs is not something to do on every request. */
const TTL_MS = 10 * 60 * 1000

/**
 * The observed ratio series, from chain events.
 *
 * Returns an empty array rather than throwing: the chart already knows how to
 * say it has too few points, and a history failure must not take down a page
 * whose live numbers are fine.
 */
export async function chainSeries(): Promise<Sample[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.samples

  try {
    const head = await client.getBlockNumber()
    const from = head > LOOKBACK_BLOCKS ? head - LOOKBACK_BLOCKS : 0n

    const [xom, uso] = await Promise.all([
      poolPrices(POOLS.XOM, from, head),
      poolPrices(POOLS.USO, from, head),
    ])

    const joined = join(xom, uso)
    if (joined.length === 0) return cached?.samples ?? []

    // Block numbers become timestamps by counting back from the head at this
    // chain's measured block time. Fetching a block per sample would be
    // hundreds of round trips for a resolution nobody reads.
    const headBlock = await client.getBlock({ blockNumber: head })
    const headTime = Number(headBlock.timestamp) * 1000
    const msPerBlock = 100

    const samples: Sample[] = joined.map((point) => ({
      t: headTime - (Number(head) - point.t) * msPerBlock,
      ratio: point.price,
      // Pool fees, not the quoted spread: 0.20% plus 0.12% across the two hops.
      spreadBps: 32,
      open: false,
    }))

    cached = { samples, at: Date.now() }
    return samples
  } catch {
    return cached?.samples ?? []
  }
}
