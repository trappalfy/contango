'use client'

import { useEffect, useRef } from 'react'
import {
  CELL_ASPECT,
  EMPTY_BELOW,
  buildField,
  columnsFor,
  glyphFor,
  isVertical,
  stopColor,
  stopFor,
  tipCells,
} from '@/lib/footer/field'

/**
 * The canvas that draws the symbol field — §7 and §11 of the footer brief.
 *
 * One `<canvas>`, one pass, never DOM cells: the grid runs to roughly seven
 * thousand cells and that many elements would take the layout down with it.
 *
 * Nothing here starts until the section is near the viewport, and the frame
 * rate is deliberately low — §7.5 asks for 12fps because symbol art at 60
 * reads as flicker, and it costs a fifth as much.
 */

/** §7.5 — the canvas repaints far slower than the display refreshes. */
const FPS = 12
const FPS_NARROW = 8

/** §7.5 — share of cells that pick a new glyph each frame. Not brightness. */
const CHURN = 0.015

/** §7.5 — the only accented animation in the footer. */
const PULSE_RADIUS_CELLS = 6
const PULSE_PERIOD_MS = 3500
const PULSE_DEPTH = 0.12

/** §7.5 — one wave, left to right, the first time the field is seen. */
const REVEAL_MS = 900

/** §11 — start work before the section arrives, but not on page load. */
const ROOT_MARGIN = '400px'

/** §11 — resize is debounced; the field is not rebuilt per pixel. */
const RESIZE_DEBOUNCE_MS = 150

type Grid = {
  cols: number
  rows: number
  cellW: number
  cellH: number
  field: Float32Array
  salt: Uint8Array
  tips: ReturnType<typeof tipCells>
  vertical: boolean
}

export function SymbolField({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    // Narrowed once, into names the nested helpers can close over. Control-flow
    // analysis does not follow the guards above into a function declaration.
    const el: HTMLCanvasElement = canvas
    const ctx: CanvasRenderingContext2D = context

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let grid: Grid | null = null
    let frame = 0
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    let revealStart = 0
    let running = false
    let lastPaint = 0

    /** The mono actually in use, resolved from the CSS variable on the canvas. */
    const fontFamily = () => getComputedStyle(el).fontFamily || 'monospace'

    function build(): Grid | null {
      const canvasEl = canvasRef.current
      if (!canvasEl) return null

      const width = canvasEl.clientWidth
      const height = canvasEl.clientHeight
      if (width < 2 || height < 2) return null

      const vertical = isVertical(window.innerWidth)
      const cols = columnsFor(window.innerWidth)
      const cellW = width / cols
      const cellH = cellW * CELL_ASPECT
      const rows = Math.max(1, Math.round(height / cellH))

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvasEl.width = Math.round(width * dpr)
      canvasEl.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      return {
        cols,
        rows,
        cellW,
        cellH: height / rows,
        field: buildField(cols, rows, vertical),
        salt: new Uint8Array(cols * rows),
        tips: tipCells(cols, rows, vertical),
        vertical,
      }
    }

    /** Extra brightness at the two tips, in antiphase. Zero everywhere else. */
    function pulseAt(g: Grid, col: number, row: number, now: number): number {
      if (reduced) return 1

      for (let i = 0; i < g.tips.length; i++) {
        const tip = g.tips[i]
        const dc = col - tip.col
        const dr = row - tip.row
        const distance = Math.sqrt(dc * dc + dr * dr)
        if (distance > PULSE_RADIUS_CELLS) continue

        const falloff = 1 - distance / PULSE_RADIUS_CELLS
        // The two sides breathe against each other, never together.
        const phase = (now / PULSE_PERIOD_MS) * Math.PI * 2 + (i === 0 ? 0 : Math.PI)
        return 1 + PULSE_DEPTH * falloff * Math.sin(phase)
      }

      return 1
    }

    function paint(now: number) {
      const g = grid
      if (!g) return

      const width = el.clientWidth
      const height = el.clientHeight
      ctx.clearRect(0, 0, width, height)

      const size = g.cellW * 1.45
      ctx.font = `${size.toFixed(2)}px ${fontFamily()}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      // How far the reveal wave has travelled, in columns.
      const revealed = reduced
        ? g.cols
        : ((now - revealStart) / REVEAL_MS) * g.cols * 1.15

      // Six passes, one per ramp stop, so the fill colour is set six times a
      // frame instead of once per cell. With ~2300 live cells that is the
      // difference between a cheap repaint and a stalled one.
      for (let stop = 0; stop < 6; stop++) {
        ctx.fillStyle = stopColor(stop)

        for (let row = 0; row < g.rows; row++) {
          for (let col = 0; col < g.cols; col++) {
            const index = row * g.cols + col
            const base = g.field[index]
            if (base < EMPTY_BELOW) continue

            // The wave front is jittered so it arrives as a wave and not as a
            // ruler sliding across the picture.
            if (revealed < g.cols && col > revealed + ((index * 2654435761) % 7) - 3) continue

            const value = Math.min(1, base * pulseAt(g, col, row, now))
            if (stopFor(value) !== stop) continue

            const glyph = glyphFor(value, col, row, g.salt[index])
            if (!glyph) continue

            ctx.fillText(glyph, (col + 0.5) * g.cellW, (row + 0.5) * g.cellH)
          }
        }

      }
    }

    function churn(g: Grid) {
      const total = g.cols * g.rows
      const count = Math.round(total * CHURN)
      for (let i = 0; i < count; i++) {
        const at = (Math.random() * total) | 0
        // Only the letterform moves: brightness and colour are untouched.
        g.salt[at] = (g.salt[at] + 1) & 0xff
      }
    }

    const interval = () => 1000 / (grid?.vertical ? FPS_NARROW : FPS)

    function tick(now: number) {
      if (!running) return
      frame = requestAnimationFrame(tick)

      if (now - lastPaint < interval()) return
      lastPaint = now

      if (grid && !reduced) churn(grid)
      paint(now)
    }

    function start() {
      if (running) return
      grid = build()
      if (!grid) return
      running = true
      revealStart = performance.now()
      lastPaint = 0
      frame = requestAnimationFrame(tick)
    }

    function stop() {
      running = false
      cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) start()
          else stop()
        }
      },
      { rootMargin: ROOT_MARGIN },
    )
    observer.observe(el)

    function onResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        if (!running) return
        grid = build()
        // A rebuild is a new picture; let it arrive the same way the first did.
        revealStart = performance.now()
        lastPaint = 0
      }, RESIZE_DEBOUNCE_MS)
    }
    window.addEventListener('resize', onResize)

    // Metrics are wrong until the mono has loaded, and a mono drawn with
    // fallback metrics lands off-centre in its cell.
    void document.fonts?.ready.then(() => {
      if (running) {
        grid = build()
        lastPaint = 0
      }
    })

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', onResize)
      clearTimeout(resizeTimer)
      stop()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ fontFamily: 'var(--font-mono-data), monospace', display: 'block', ...style }}
    />
  )
}
