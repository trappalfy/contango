'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Eyebrow, HAIRLINE, Panel } from '@/components/ui/primitives'

/* --------------------------------------------------------------------------
 * Palette
 *
 * One series, so there is no categorical set to separate — but the warn marker
 * shares the plot with the line, so the two were validated as a pair against
 * the #030305 surface: ΔE 18.9 normal vision, 12.0 protan, contrast >= 3:1.
 * Both sit above the validator's lightness band, which is deliberate on a
 * near-black ground and is the one check knowingly not met.
 * ------------------------------------------------------------------------ */
const LINE = '#8E93FF'
const WARN = '#FCA8E0'
const GRID = 'rgba(255,255,255,0.07)'
const AXIS_TEXT = 'rgba(255,255,255,0.42)'

type Sample = { t: number; ratio: number; spreadBps: number; open: boolean }
type Band = { mean: number; sd: number; z: number | null; count: number }
type Payload = { samples: Sample[]; band: Band | null }

const VIEW = { w: 720, h: 260 }
const PAD = { top: 16, right: 56, bottom: 26, left: 8 }

const timeLabel = (t: number) =>
  new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** |z| beyond this is worth flagging rather than just plotting. */
const Z_WARN = 2

export function RatioChart({ pollMs = 60_000 }: { pollMs?: number }) {
  const [data, setData] = useState<Payload | null>(null)
  const [failed, setFailed] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const response = await fetch('/api/history')
        if (!response.ok) throw new Error(String(response.status))
        const payload = (await response.json()) as Payload
        if (alive) {
          setData(payload)
          setFailed(false)
        }
      } catch {
        if (alive) setFailed(true)
      }
    }
    void load()
    const timer = setInterval(load, pollMs)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [pollMs])

  // Memoised so the empty-array fallback does not give useMemo a new identity
  // on every render.
  const samples = useMemo(() => data?.samples ?? [], [data])
  const bandStats = data?.band ?? null

  const geometry = useMemo(() => {
    if (samples.length < 2) return null

    const xs = samples.map((s) => s.t)
    const ys = samples.map((s) => s.ratio)

    const minT = Math.min(...xs)
    const maxT = Math.max(...xs)
    let minY = Math.min(...ys)
    let maxY = Math.max(...ys)

    if (bandStats) {
      minY = Math.min(minY, bandStats.mean - bandStats.sd)
      maxY = Math.max(maxY, bandStats.mean + bandStats.sd)
    }

    // A flat series must not collapse to a single line at the top edge.
    const spread = maxY - minY || Math.max(maxY * 0.002, 1e-6)
    minY -= spread * 0.15
    maxY += spread * 0.15

    const plotW = VIEW.w - PAD.left - PAD.right
    const plotH = VIEW.h - PAD.top - PAD.bottom

    const x = (t: number) => PAD.left + (maxT === minT ? plotW : ((t - minT) / (maxT - minT)) * plotW)
    const y = (v: number) => PAD.top + plotH - ((v - minY) / (maxY - minY)) * plotH

    const path = samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.t).toFixed(2)},${y(s.ratio).toFixed(2)}`).join(' ')

    return { x, y, path, minY, maxY, minT, maxT, plotW, plotH }
  }, [samples, bandStats])

  const latest = samples[samples.length - 1]
  const active = hover != null ? samples[hover] : latest
  const flagged = bandStats?.z != null && Math.abs(bandStats.z) >= Z_WARN

  const onMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!geometry || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * VIEW.w
    // Nearest sample to the pointer, not the one directly under it — the hit
    // target has to be bigger than a 2px line.
    let best = 0
    let bestDistance = Infinity
    samples.forEach((s, i) => {
      const distance = Math.abs(geometry.x(s.t) - px)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    })
    setHover(best)
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Eyebrow>XOM / USO · observed ratio</Eyebrow>
          <div className="mt-3 flex items-baseline gap-3">
            <span
              className="font-mono"
              style={{
                fontSize: 'clamp(20px,2.2vw,30px)',
                color: '#fff',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {active ? active.ratio.toFixed(4) : '—'}
            </span>
            {bandStats?.z != null && (
              <span
                className="font-mono"
                style={{ fontSize: 12, color: flagged ? WARN : AXIS_TEXT }}
              >
                {bandStats.z >= 0 ? '+' : ''}
                {bandStats.z.toFixed(2)}σ{flagged ? ' ⚠' : ''}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
          style={{
            fontSize: 10,
            letterSpacing: '.14em',
            border: `1px solid ${HAIRLINE}`,
            background: 'transparent',
            color: 'rgba(255,255,255,0.55)',
            padding: '6px 10px',
            cursor: 'pointer',
          }}
        >
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {/* ---------------- states ---------------- */}
      {failed && (
        <p style={{ fontSize: 12, color: WARN, marginTop: 20 }}>
          Could not load the recorded series.
        </p>
      )}

      {!failed && samples.length < 2 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)' }}>
            Collecting. This series does not exist anywhere to be bought — it is recorded here, one
            sample a minute, starting from when the server came up.
          </p>
          <p className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 10 }}>
            {samples.length} sample{samples.length === 1 ? '' : 's'} so far
          </p>
        </div>
      )}

      {/* ---------------- table view ---------------- */}
      {!failed && samples.length >= 2 && showTable && (
        <div className="mt-6 overflow-auto" style={{ maxHeight: 260 }}>
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <caption className="sr-only">Observed XOM to USO ratio over time</caption>
            <thead>
              <tr>
                {['Time', 'Ratio', 'Spread', 'Session'].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="font-mono uppercase"
                    style={{
                      textAlign: 'left',
                      fontSize: 9,
                      letterSpacing: '.14em',
                      color: AXIS_TEXT,
                      fontWeight: 400,
                      padding: '0 12px 10px 0',
                      borderBottom: `1px solid ${HAIRLINE}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {samples
                .slice()
                .reverse()
                .map((s) => (
                  <tr key={s.t}>
                    {[timeLabel(s.t), s.ratio.toFixed(4), `${s.spreadBps.toFixed(1)} bps`, s.open ? 'Open' : 'Closed'].map(
                      (cell, i) => (
                        <td
                          key={i}
                          className="font-mono"
                          style={{
                            padding: '8px 12px 8px 0',
                            borderBottom: `1px solid ${HAIRLINE}`,
                            fontSize: 11,
                            color: i === 0 ? AXIS_TEXT : '#fff',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------------- chart ---------------- */}
      {!failed && samples.length >= 2 && !showTable && geometry && (
        <>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={`Observed XOM to USO ratio, ${samples.length} samples, currently ${latest?.ratio.toFixed(4)}`}
            style={{ width: '100%', height: 260, marginTop: 20, display: 'block', touchAction: 'none' }}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            {/* Normal band, drawn behind everything: context, not a second series. */}
            {bandStats && (
              <>
                <rect
                  x={PAD.left}
                  y={geometry.y(bandStats.mean + bandStats.sd)}
                  width={geometry.plotW}
                  height={Math.max(
                    1,
                    geometry.y(bandStats.mean - bandStats.sd) - geometry.y(bandStats.mean + bandStats.sd),
                  )}
                  fill={LINE}
                  opacity={0.09}
                />
                <line
                  x1={PAD.left}
                  x2={PAD.left + geometry.plotW}
                  y1={geometry.y(bandStats.mean)}
                  y2={geometry.y(bandStats.mean)}
                  stroke={LINE}
                  strokeOpacity={0.35}
                  strokeDasharray="3 4"
                  strokeWidth={1}
                />
              </>
            )}

            {/* Recessive gridlines with their values at the right edge. */}
            {[0, 0.5, 1].map((f) => {
              const value = geometry.minY + (geometry.maxY - geometry.minY) * f
              const yy = geometry.y(value)
              return (
                <g key={f}>
                  <line
                    x1={PAD.left}
                    x2={PAD.left + geometry.plotW}
                    y1={yy}
                    y2={yy}
                    stroke={GRID}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left + geometry.plotW + 8}
                    y={yy + 3}
                    fill={AXIS_TEXT}
                    style={{ fontSize: 9, fontFamily: 'var(--font-mono-data), monospace' }}
                  >
                    {value.toFixed(4)}
                  </text>
                </g>
              )
            })}

            <path d={geometry.path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" />

            {/* Latest point, direct-labelled. Never a label on every point. */}
            {latest && (
              <circle cx={geometry.x(latest.t)} cy={geometry.y(latest.ratio)} r={4} fill={flagged ? WARN : LINE} />
            )}

            {/* Crosshair */}
            {hover != null && samples[hover] && (
              <>
                <line
                  x1={geometry.x(samples[hover].t)}
                  x2={geometry.x(samples[hover].t)}
                  y1={PAD.top}
                  y2={PAD.top + geometry.plotH}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={1}
                />
                <circle
                  cx={geometry.x(samples[hover].t)}
                  cy={geometry.y(samples[hover].ratio)}
                  r={4.5}
                  fill={LINE}
                  stroke="#030305"
                  strokeWidth={2}
                />
              </>
            )}

            <text
              x={PAD.left}
              y={VIEW.h - 8}
              fill={AXIS_TEXT}
              style={{ fontSize: 9, fontFamily: 'var(--font-mono-data), monospace' }}
            >
              {timeLabel(geometry.minT)}
            </text>
            <text
              x={PAD.left + geometry.plotW}
              y={VIEW.h - 8}
              textAnchor="end"
              fill={AXIS_TEXT}
              style={{ fontSize: 9, fontFamily: 'var(--font-mono-data), monospace' }}
            >
              {timeLabel(geometry.maxT)}
            </text>
          </svg>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono" style={{ fontSize: 11, color: AXIS_TEXT }}>
              {hover != null && samples[hover]
                ? `${timeLabel(samples[hover].t)} · ${samples[hover].ratio.toFixed(4)} · ${samples[hover].spreadBps.toFixed(1)} bps · ${samples[hover].open ? 'open' : 'closed'}`
                : `${samples.length} samples recorded`}
            </span>
            {bandStats && (
              <span className="font-mono" style={{ fontSize: 11, color: AXIS_TEXT }}>
                mean {bandStats.mean.toFixed(4)} · σ {bandStats.sd.toFixed(5)}
              </span>
            )}
          </div>

          {!bandStats && (
            <p style={{ fontSize: 11, lineHeight: 1.6, color: 'rgba(255,255,255,0.38)', marginTop: 12 }}>
              No band yet. One is drawn only past twenty samples — a band built from a handful of
              points looks authoritative and means nothing.
            </p>
          )}
        </>
      )}
    </Panel>
  )
}
