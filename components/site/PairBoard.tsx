import { findBySymbol, getAssets, getQuotes } from '@/lib/rh/client'
import { PAIR, buildLeg, buildPair, marketSession, rangePosition, type Leg } from '@/lib/pair'
import { formatDec, formatMoney } from '@/lib/decimal'
import { Eyebrow, HAIRLINE, Panel, Pill, Row, Stat } from '@/components/ui/primitives'
import { record } from '@/lib/history'

/** Loads both legs. Returns null when the upstream is unreachable and nothing is cached. */
export async function loadPair() {
  try {
    const [assets, quotes] = await Promise.all([getAssets(), getQuotes()])

    const equity = buildLeg(
      PAIR.equity,
      findBySymbol(assets.data, PAIR.equity.symbol),
      findBySymbol(quotes.data, PAIR.equity.symbol),
    )
    const fund = buildLeg(
      PAIR.fund,
      findBySymbol(assets.data, PAIR.fund.symbol),
      findBySymbol(quotes.data, PAIR.fund.symbol),
    )

    const pair = buildPair(equity, fund)
    if (!pair) return null

    // Every load contributes a sample. This is the only way the ratio series
    // ever comes into existence — nobody sells it.
    record(pair.ratio, pair.roundTripBps, marketSession().open)

    return {
      pair,
      stale: assets.stale || quotes.stale,
      // Measured here rather than during render: the render pass must stay pure,
      // and this is the age at the moment the request was served anyway.
      ageSeconds: Math.max(0, Math.round((Date.now() - quotes.fetchedAt) / 1000)),
    }
  } catch {
    return null
  }
}

function LegCard({ leg }: { leg: Leg }) {
  const position = rangePosition(leg)

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span
              className="font-mono"
              style={{ fontSize: 18, letterSpacing: '.06em', color: '#fff' }}
            >
              {leg.symbol}
            </span>
            <Pill tone={leg.halted ? 'warn' : 'neutral'}>
              {leg.halted ? 'Halted' : leg.kind}
            </Pill>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>{leg.label}</p>
        </div>

        <div className="text-right">
          <div
            className="font-mono"
            style={{ fontSize: 'clamp(20px,2.2vw,30px)', fontVariantNumeric: 'tabular-nums' }}
          >
            ${formatMoney(leg.tokenPrice)}
          </div>
          <div className="font-mono" style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>
            PER TOKEN
          </div>
        </div>
      </div>

      <p
        style={{
          fontSize: 12,
          lineHeight: 1.55,
          color: 'rgba(255,255,255,0.46)',
          marginTop: 18,
          marginBottom: 18,
        }}
      >
        {leg.mechanism}
      </p>

      <div style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <Row label="Bid / Ask" value={`${formatMoney(leg.bid)} / ${formatMoney(leg.ask)}`} />
        <Row label="Spread" value={`${leg.spreadBps.toFixed(1)} bps`} />
        <Row
          label="Multiplier"
          value={
            leg.hasCorporateAdjustment ? `${formatDec(leg.multiplier, 6)} ⚠` : formatDec(leg.multiplier, 6)
          }
        />
        {leg.dailyLow && leg.dailyHigh && (
          <Row
            label="Session range"
            value={`${formatMoney(leg.dailyLow)} — ${formatMoney(leg.dailyHigh)}`}
          />
        )}
      </div>

      {position !== null && (
        <div className="mt-5">
          <div style={{ height: 2, background: 'rgba(255,255,255,0.09)', position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: `${position * 100}%`,
                top: -3,
                width: 2,
                height: 8,
                background: '#8E93FF',
              }}
            />
          </div>
        </div>
      )}
    </Panel>
  )
}

export async function PairBoard({ compact = false }: { compact?: boolean }) {
  const loaded = await loadPair()
  const session = marketSession()

  if (!loaded) {
    return (
      <Panel>
        <Eyebrow>Live quotes</Eyebrow>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.62)', marginTop: 12 }}>
          The Robinhood quote feed is not answering right now. It rate-limits aggressively, so this
          usually clears within a few seconds.
        </p>
      </Panel>
    )
  }

  const { pair, stale, ageSeconds } = loaded

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone={session.open ? 'live' : 'neutral'}>{session.label}</Pill>
        {stale && <Pill tone="warn">Cached</Pill>}
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>{session.detail}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LegCard leg={pair.equity} />
        <LegCard leg={pair.fund} />
      </div>

      {!compact && (
        <Panel accent>
          <div className="grid gap-8 sm:grid-cols-3">
            <Stat
              label="XOM / USO"
              value={formatDec(pair.ratio, 4)}
              hint="Tokens of USO per token of XOM"
              tone="accent"
            />
            <Stat
              label="Round trip cost"
              value={`${pair.roundTripBps.toFixed(1)} bps`}
              hint="Both legs crossed once"
            />
            <Stat
              label="Quote age"
              value={`${ageSeconds}s`}
              hint={stale ? 'Serving last good data' : 'Cached for 20s'}
              tone={stale ? 'muted' : 'default'}
            />
          </div>
        </Panel>
      )}
    </div>
  )
}
