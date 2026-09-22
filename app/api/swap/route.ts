import { NextResponse } from 'next/server'
import { isAddress, parseUnits } from 'viem'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import {
  ROUTING_CONFIGURED,
  fetchSpender,
  fetchSwap,
  routeHops,
  routeNames,
} from '@/lib/oneinch/client'
import type { SwapResponse } from '@/lib/swap/types'

export const dynamic = 'force-dynamic'

const SUPPORTED: TokenSymbol[] = ['XOM', 'USO']

/** Anything outside this is either pointless or dangerous. */
const MIN_SLIPPAGE = 0.05
const MAX_SLIPPAGE = 5

/**
 * Builds the transaction for a rotation.
 *
 * Separate from `/api/quote` on purpose: this costs a second aggregator call,
 * is bound to one wallet, and goes stale within seconds. It is requested when
 * someone commits to the trade, not while they are typing.
 *
 * The spender comes from 1inch rather than from configuration. Hardcoding a
 * router address means the day 1inch migrates one, every approval in the app
 * starts pointing at a contract that no longer executes.
 */
export async function POST(request: Request): Promise<NextResponse<SwapResponse>> {
  if (!ROUTING_CONFIGURED) {
    return NextResponse.json(
      { ok: false, error: 'This deployment has no aggregator key, so there is no route to execute against.' },
      { status: 501 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 })
  }

  const { from, to, amount, wallet, slippage } = (body ?? {}) as Record<string, unknown>

  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    typeof amount !== 'string' ||
    !SUPPORTED.includes(from as TokenSymbol) ||
    !SUPPORTED.includes(to as TokenSymbol) ||
    from === to
  ) {
    return NextResponse.json({ ok: false, error: 'Unsupported pair.' }, { status: 400 })
  }

  if (typeof wallet !== 'string' || !isAddress(wallet)) {
    return NextResponse.json({ ok: false, error: 'A connected wallet address is required.' }, { status: 400 })
  }

  const tolerance = typeof slippage === 'number' ? slippage : Number(slippage)
  if (!Number.isFinite(tolerance) || tolerance < MIN_SLIPPAGE || tolerance > MAX_SLIPPAGE) {
    return NextResponse.json(
      { ok: false, error: `Slippage must be between ${MIN_SLIPPAGE}% and ${MAX_SLIPPAGE}%.` },
      { status: 400 },
    )
  }

  const src = TOKENS[from as TokenSymbol]
  const dst = TOKENS[to as TokenSymbol]

  let amountInWei: bigint
  try {
    amountInWei = parseUnits(amount, src.decimals)
  } catch {
    return NextResponse.json({ ok: false, error: 'Amount has too many decimal places.' }, { status: 400 })
  }
  if (amountInWei <= 0n) {
    return NextResponse.json({ ok: false, error: 'Amount rounds to zero.' }, { status: 400 })
  }

  try {
    const [spender, swap] = await Promise.all([
      fetchSpender(),
      fetchSwap({
        src: src.address,
        dst: dst.address,
        amount: amountInWei.toString(),
        from: wallet,
        slippage: tolerance,
      }),
    ])

    const out = BigInt(swap.dstAmount)
    // 1inch encodes its own minimum into the calldata from the slippage we
    // sent; this is the same figure, surfaced so the interface can show what
    // the person is actually agreeing to.
    const minOut = (out * BigInt(Math.round((100 - tolerance) * 100))) / 10_000n

    return NextResponse.json({
      ok: true,
      plan: {
        spender,
        to: swap.tx.to,
        data: swap.tx.data,
        value: swap.tx.value,
        gas: typeof swap.tx.gas === 'number' ? swap.tx.gas : undefined,
        amountOut: swap.dstAmount,
        minAmountOut: minOut.toString(),
        route: routeNames(swap.protocols),
        hops: routeHops(swap.protocols),
        slippage: tolerance,
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown'
    const status = typeof (error as { status?: number }).status === 'number' ? (error as { status: number }).status : 502
    return NextResponse.json(
      { ok: false, error: `The aggregator could not build this swap: ${detail}` },
      { status: status >= 400 && status < 600 ? status : 502 },
    )
  }
}
