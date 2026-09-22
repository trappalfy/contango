import { NextResponse } from 'next/server'
import { formatUnits, parseUnits } from 'viem'
import { findBySymbol, getAssets, getQuotes } from '@/lib/rh/client'
import { PAIR, buildLeg } from '@/lib/pair'
import { div, formatDec, mul, parseDec } from '@/lib/decimal'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import { LiquidityError, quoteRotation } from '@/lib/v4/quote'
import { VENUE, VIA } from '@/lib/v4/config'
import type { QuoteResponse, RotationQuote } from '@/lib/swap/types'

export const dynamic = 'force-dynamic'

const SUPPORTED: TokenSymbol[] = ['XOM', 'USO']

/**
 * Prices a rotation.
 *
 * Two numbers come out of one request. Robinhood's feed gives the mid-price
 * ratio, which is the reference. The v4 Quoter walks the actual curve and
 * gives what the swap returns, fees and depth included. The gap between them
 * is the true cost, reported rather than buried.
 *
 * Quoting reads the chain directly, so it needs no key and cannot be rate
 * limited by anyone. If the chain read fails the mid-price arithmetic still
 * goes out, clearly labelled — and the form will not trade on it.
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
      XOM: buildLeg(PAIR.equity, findBySymbol(assets.data, 'XOM'), findBySymbol(quotes.data, 'XOM')),
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

    // Mid to mid, before any cost. A reference, not an offer.
    const ratio = div(source.tokenPrice, target.tokenPrice)
    const spreadBps = source.spreadBps + target.spreadBps
    const midOut = mul(parseDec(amount), ratio)

    try {
      const routed = await quoteRotation(from as TokenSymbol, to as TokenSymbol, amountInWei)
      const out = parseDec(formatUnits(routed.amountOut, dst.decimals))
      const shortfall = midOut > 0n ? Number(((midOut - out) * 10_000n) / midOut) : 0

      const quote: RotationQuote = {
        source: 'routed',
        from: from as TokenSymbol,
        to: to as TokenSymbol,
        amountIn: amount,
        amountOut: formatDec(out, Math.min(8, dst.decimals)),
        amountOutWei: routed.amountOut.toString(),
        ratio: formatDec(ratio, 8),
        spreadBps,
        priceImpactBps: shortfall,
        route: [VENUE],
        hops: 2,
        via: VIA,
        estimatedGas: Number(routed.gasEstimate),
      }

      return NextResponse.json({ ok: true, quote })
    } catch (error) {
      // A size the pools cannot fill is a real answer, not a fault. Saying so
      // beats showing a mid-price number nobody could have traded on.
      if (error instanceof LiquidityError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 409 })
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
          'Could not reach the pools just now, so this is mid-price arithmetic. It understates the real cost and is not executable.',
        ),
      })
    }
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
