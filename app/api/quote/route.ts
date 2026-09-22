import { NextResponse } from 'next/server'
import { formatUnits, parseUnits } from 'viem'
import { findBySymbol, getAssets, getQuotes } from '@/lib/rh/client'
import { PAIR, buildLeg } from '@/lib/pair'
import { div, formatDec, mul, parseDec } from '@/lib/decimal'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import {
  ROUTING_CONFIGURED,
  fetchQuote,
  routeHops,
  routeNames,
} from '@/lib/oneinch/client'
import type { QuoteResponse, RotationQuote } from '@/lib/swap/types'

export const dynamic = 'force-dynamic'

const SUPPORTED: TokenSymbol[] = ['XOM', 'USO']

/**
 * Prices a rotation between the two legs.
 *
 * Two prices are produced from the same request. The mid-price arithmetic on
 * Robinhood's feed gives the ratio and, more usefully, a reference to measure
 * against. 1inch gives what the swap would actually return against the pools
 * that exist. The gap between them is the real cost of the rotation, and it is
 * reported as `priceImpactBps` rather than buried.
 *
 * When no key is configured the indicative number still goes out, clearly
 * labelled, because the rest of the interface is built on it — but it is never
 * executable, and the form refuses to trade on it.
 */
export async function POST(request: Request): Promise<NextResponse<QuoteResponse>> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Malformed request body.' }, { status: 400 })
  }

  const { from, to, amount } = (body ?? {}) as Record<string, unknown>

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

  if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) {
    return NextResponse.json({ ok: false, error: 'Amount must be a positive number.' }, { status: 400 })
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
    const [assets, quotes] = await Promise.all([getAssets(), getQuotes()])

    const legs = {
      XOM: buildLeg(
        PAIR.equity,
        findBySymbol(assets.data, 'XOM'),
        findBySymbol(quotes.data, 'XOM'),
      ),
      USO: buildLeg(PAIR.fund, findBySymbol(assets.data, 'USO'), findBySymbol(quotes.data, 'USO')),
    }

    const source = legs[from as 'XOM' | 'USO']
    const target = legs[to as 'XOM' | 'USO']

    if (!source || !target) {
      return NextResponse.json({ ok: false, error: 'Quote feed is unavailable.' }, { status: 503 })
    }

    if (source.halted || target.halted) {
      return NextResponse.json(
        { ok: false, error: 'One of the legs is halted. Rotation is not priceable right now.' },
        { status: 409 },
      )
    }

    // Mid to mid, before any cost. This is the reference, not an offer.
    const ratio = div(source.tokenPrice, target.tokenPrice)
    const spreadBps = source.spreadBps + target.spreadBps
    const midOut = mul(parseDec(amount), ratio)

    if (ROUTING_CONFIGURED) {
      try {
        const routed = await fetchQuote({
          src: src.address,
          dst: dst.address,
          amount: amountInWei.toString(),
        })

        const out = parseDec(formatUnits(BigInt(routed.dstAmount), dst.decimals))
        // How far the achievable output falls short of the mid-price value of
        // the input: pool fees and depth together, in one honest number.
        const shortfall = midOut > 0n ? Number(((midOut - out) * 10_000n) / midOut) : 0
        const hops = routeHops(routed.protocols)

        const quote: RotationQuote = {
          source: 'routed',
          from: from as TokenSymbol,
          to: to as TokenSymbol,
          amountIn: amount,
          amountOut: formatDec(out, Math.min(8, dst.decimals)),
          ratio: formatDec(ratio, 8),
          spreadBps,
          priceImpactBps: shortfall,
          route: routeNames(routed.protocols),
          hops,
          via: hops > 1 ? TOKENS.USDG.symbol : undefined,
          estimatedGas: routed.gas,
        }

        return NextResponse.json({ ok: true, quote })
      } catch (error) {
        // Fall through to the indicative price rather than blanking the panel.
        // The label is what keeps this honest: the form will not trade on it.
        const detail = error instanceof Error ? error.message : 'aggregator unavailable'
        return NextResponse.json({
          ok: true,
          quote: indicative(
            from as TokenSymbol,
            to as TokenSymbol,
            amount,
            midOut,
            ratio,
            spreadBps,
            dst.decimals,
            `Routed pricing is unavailable right now (${detail}). This is mid-price arithmetic and understates the real cost.`,
          ),
        })
      }
    }

    return NextResponse.json({
      ok: true,
      quote: indicative(
        from as TokenSymbol,
        to as TokenSymbol,
        amount,
        midOut,
        ratio,
        spreadBps,
        dst.decimals,
        'Mid-price arithmetic. There is no direct XOM/USO pool, so a real rotation crosses two pools via USDG and costs materially more than this. Connect an aggregator key for an executable price.',
      ),
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not reach the quote feed. It rate-limits hard; try again shortly.' },
      { status: 503 },
    )
  }
}

function indicative(
  from: TokenSymbol,
  to: TokenSymbol,
  amount: string,
  midOut: bigint,
  ratio: bigint,
  spreadBps: number,
  decimals: number,
  note: string,
): RotationQuote {
  const net = mul(midOut, parseDec(String(1 - spreadBps / 10000)))
  return {
    source: 'indicative',
    from,
    to,
    amountIn: amount,
    amountOut: formatDec(net, Math.min(8, decimals)),
    ratio: formatDec(ratio, 8),
    spreadBps,
    note,
  }
}
