import { NextResponse } from 'next/server'
import { findBySymbol, getAssets, getQuotes } from '@/lib/rh/client'
import { PAIR, buildLeg } from '@/lib/pair'
import { div, formatDec, mul, parseDec } from '@/lib/decimal'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import type { QuoteResponse, RotationQuote } from '@/lib/swap/types'

export const dynamic = 'force-dynamic'

const SUPPORTED: TokenSymbol[] = ['XOM', 'USO']

/**
 * Prices a rotation between the two legs.
 *
 * ---------------------------------------------------------------------------
 * THE SEAM
 *
 * Today this returns an *indicative* quote: mid price in, mid price out, with
 * the round-trip spread charged against it. That is real arithmetic on real
 * live prices, and it is enough to drive the whole interface.
 *
 * To make it a *routed* quote — the last thing standing between this build and
 * a working swap — call the 1inch Swap API for chain 4663 here with
 * ONEINCH_API_KEY, and return its `dstAmount`, price impact and route in the
 * same shape. Nothing else in the app has to change: the client only ever
 * reads `RotationQuote`.
 * ---------------------------------------------------------------------------
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

    // Value in, value out, with the cost of crossing both books taken off.
    const ratio = div(source.tokenPrice, target.tokenPrice)
    const spreadBps = source.spreadBps + target.spreadBps
    const gross = mul(parseDec(amount), ratio)
    const net = mul(gross, parseDec(String(1 - spreadBps / 10000)))

    const quote: RotationQuote = {
      source: 'indicative',
      from: from as TokenSymbol,
      to: to as TokenSymbol,
      amountIn: amount,
      amountOut: formatDec(net, Math.min(8, TOKENS[to as TokenSymbol].decimals)),
      ratio: formatDec(ratio, 8),
      spreadBps,
      note: 'Mid-price arithmetic. Pool depth and price impact are not included until aggregator routing is connected.',
    }

    return NextResponse.json({ ok: true, quote })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not reach the quote feed. It rate-limits hard; try again shortly.' },
      { status: 503 },
    )
  }
}
