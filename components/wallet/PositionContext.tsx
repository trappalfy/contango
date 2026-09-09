'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { Eyebrow, HAIRLINE, Panel, Row, Stat } from '@/components/ui/primitives'

/** Mirrors MIN_SAMPLES_FOR_BAND in lib/history.ts, which is server-side. */
const MIN_SAMPLES_FOR_BAND = 20

type Band = { mean: number; sd: number; z: number | null; count: number }
type Payload = { samples: { t: number; ratio: number }[]; band: Band | null }

const Z_STRETCHED = 2

/**
 * What the recorded ratio implies for whichever leg is held.
 *
 * This is the one piece of "signal" the product can honestly show today: it is
 * computed from observations this deployment actually made, and it says so.
 */
export function PositionContext({ heldLeg }: { heldLeg: 'XOM' | 'USO' | null }) {
  const { isConnected } = useAccount()
  const [data, setData] = useState<Payload | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/history')
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        if (alive) setData(payload)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const band = data?.band ?? null
  const count = data?.samples.length ?? 0
  const z = band?.z ?? null
  const stretched = z != null && Math.abs(z) >= Z_STRETCHED

  const reading = (() => {
    if (!band || z == null) {
      return `Not enough recorded samples yet. A band appears past ${MIN_SAMPLES_FOR_BAND}; there are ${count}.`
    }
    if (!stretched) {
      return 'The ratio is inside its observed range. Nothing here argues for moving.'
    }
    const rich = z > 0 ? 'XOM' : 'USO'
    const cheap = z > 0 ? 'USO' : 'XOM'
    const holdingRich = heldLeg === rich
    return holdingRich
      ? `${rich} is stretched against ${cheap} by ${Math.abs(z).toFixed(2)} standard deviations, and that is the side you hold.`
      : `${rich} is stretched against ${cheap} by ${Math.abs(z).toFixed(2)} standard deviations.`
  })()

  return (
    <Panel>
      <Eyebrow>Position context</Eyebrow>

      <div className="mt-6 grid gap-8 sm:grid-cols-3">
        <Stat
          label="Observed mean"
          value={band ? band.mean.toFixed(4) : '—'}
          hint="XOM per USO"
        />
        <Stat
          label="Deviation"
          value={z != null ? `${z >= 0 ? '+' : ''}${z.toFixed(2)}σ` : '—'}
          hint={stretched ? 'Outside the usual range' : 'Within range'}
          tone={stretched ? 'accent' : 'muted'}
        />
        <Stat label="Samples" value={String(count)} hint="Recorded by this deployment" tone="muted" />
      </div>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: 'rgba(255,255,255,0.62)',
          marginTop: 22,
          maxWidth: '62ch',
        }}
      >
        {reading}
      </p>

      {!isConnected && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 12 }}>
          Connect a wallet to relate this to a position.
        </p>
      )}
    </Panel>
  )
}

/**
 * Rotations this wallet has made.
 *
 * Empty until a rotation actually settles — a table of invented fills would be
 * worse than an empty one. Receipts from `useRotation` populate it, and a
 * durable version reads them back from an indexer.
 */
export function RotationHistory() {
  const { isConnected } = useAccount()

  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>Rotation history</Eyebrow>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 10, letterSpacing: '.14em', color: 'rgba(255,255,255,0.3)' }}
        >
          0 recorded
        </span>
      </div>

      <div className="mt-5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        <Row label="Rotations" value="—" />
        <Row label="Average entry ratio" value="—" />
        <Row label="Spread paid" value="—" />
        <Row label="Drift since entry" value="—" />
      </div>

      <p
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: 'rgba(255,255,255,0.42)',
          marginTop: 18,
          maxWidth: '58ch',
        }}
      >
        {isConnected
          ? 'No rotations from this address yet. Each one records the ratio it traded at, so cost basis and drift are measured against the pair rather than against a dollar price.'
          : 'Connect a wallet to see rotations made from your address.'}
      </p>
    </Panel>
  )
}
