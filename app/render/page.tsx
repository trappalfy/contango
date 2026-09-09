'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { createWelcome, type Welcome } from '@/lib/welcome/scene'
import { TOTAL_FRAMES, stateAt, textOffsetPx } from '@/lib/welcome/timeline'
import { BG_CSS, C } from '@/lib/hero.tokens'

/**
 * The capture stage — §3 of contango-welcome-video-spec.md.
 *
 * Not part of the public site. It exists so a headless browser can ask for one
 * frame at a time; there is no animation loop here at all, and every visual
 * property is a function of the frame index alone.
 *
 * Typography is DOM over the canvas rather than geometry inside three, and it
 * is driven by direct style writes rather than React state: a re-render per
 * frame would be scheduled asynchronously, and a capture cannot wait on
 * something it cannot observe.
 */

const WIDTH = 1920
const HEIGHT = 1080

/** §6 — the left-hand block for beats 2 and 3. */
const EDGE = 120

/** §8 — background lines. The site's are valgrind output, which is nobody's
 *  here; these are all ours and all checkable. */
const HUD = [
  'chainId 4663',
  'XOM  0xf9B46d3D1B22199D4D1025a9cEDB540A33F1a2d5',
  'USO  0xa30FA36Db767ad9eD3f7a60fC79526fB4d56D344',
  'settlement USDG',
  'uiMultiplier() -> 4.0',
  'permit(owner, spender, value, deadline, v, r, s)',
  'front-month roll: sell expiring, buy next',
]

const serif = 'var(--font-display-serif), Georgia, serif'
const mono = 'var(--font-mono-data), monospace'

/** Project palette (§7 of the spec is not used — see the scene module). */
const INK = C.textPrimary
const INK_MUTED = 'rgba(255,255,255,0.46)'
const INK_FAINT = 'rgba(255,255,255,0.30)'

export default function RenderPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvasEl = canvasRef.current
    const stageEl = stageRef.current
    if (!canvasEl || !stageEl) return

    let welcome: Welcome | null = null
    try {
      welcome = createWelcome(canvasEl, WIDTH, HEIGHT)
    } catch {
      // No WebGL: leave the hooks unregistered so capture fails loudly rather
      // than writing 360 empty frames.
      return
    }

    // Narrowed into names the nested draw can close over — control-flow
    // analysis does not follow the guards above into a function declaration.
    const scene: Welcome = welcome
    const canvas: HTMLCanvasElement = canvasEl
    const stage: HTMLDivElement = stageEl

    // Collected once. Every block is addressed by a data attribute rather than
    // a ref map, which keeps the lookup out of render entirely.
    const textEls = Array.from(stage.querySelectorAll<HTMLElement>('[data-block]'))
    const hud = stage.querySelector<HTMLElement>('[data-hud]')
    const black = stage.querySelector<HTMLElement>('[data-black]')

    function draw(index: number) {
      const frame = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.round(index)))
      const state = stateAt(frame)

      scene.apply(state)
      scene.render()

      canvas.style.opacity = state.sceneVisible ? '1' : '0'

      // Background lines ride the 3D beats and leave with them.
      if (hud) hud.style.opacity = state.beat <= 4 ? '1' : '0'

      for (const el of textEls) {
        const on = state.text?.id === el.dataset.block
        const enter = on && state.text ? state.text.enter : 0
        el.style.opacity = on ? String(enter) : '0'
        // A block's own centring has to survive the entry offset, so the two
        // translations are composed instead of one overwriting the other.
        const base = el.dataset.vcentre ? 'translateY(-50%) ' : ''
        el.style.transform = base + `translateY(${on ? textOffsetPx(enter) : 0}px)`
      }

      if (black) black.style.opacity = String(state.blackout)
    }

    const w = window as unknown as {
      __renderFrame?: (i: number) => Promise<void>
      __totalFrames?: number
    }

    w.__totalFrames = TOTAL_FRAMES
    w.__renderFrame = async (i: number) => {
      await document.fonts.ready
      draw(i)
    }

    draw(0)

    return () => {
      delete w.__renderFrame
      delete w.__totalFrames
      scene.dispose()
    }
  }, [])


  return (
    <>
      {/*
        The stage must be the only thing on screen. The root layout puts a nav
        and a footer around every page, and the footer runs a canvas of its own
        — hidden here so it never mounts a renderer during a capture.
      */}
      <style>{`
        header, footer { display: none !important; }
        html, body { overflow: hidden !important; margin: 0; background: #030305; }
      `}</style>

      <div
        ref={stageRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          overflow: 'hidden',
          background: BG_CSS,
          zIndex: 2147483000,
        }}
      >
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          style={{ position: 'absolute', inset: 0, display: 'block', width: WIDTH, height: HEIGHT }}
        />

        {/* §8 — ours, and every line of it checkable. */}
        <pre
          data-hud="1"
          style={{
            position: 'absolute',
            right: EDGE,
            top: 96,
            margin: 0,
            fontFamily: mono,
            fontSize: 13,
            lineHeight: 1.75,
            letterSpacing: '.02em',
            color: 'rgba(198,202,225,.20)',
            textAlign: 'right',
            whiteSpace: 'pre',
          }}
        >
          {HUD.join('\n')}
        </pre>

        {/* ---- beat 2 ---- */}
        <div data-vcentre="1" data-block="two-ways" style={leftBlock}>
          Two ways to hold oil.
        </div>

        {/* ---- beat 3 ---- */}
        <div data-vcentre="1" data-block="only-one" style={leftBlock}>
          Only one pays you for the wait.
        </div>

        {/* ---- beat 4 ---- */}
        <div
          data-block="roll-math"
          style={{ position: 'absolute', left: EDGE, bottom: EDGE, opacity: 0 }}
        >
          <div style={{ fontFamily: mono, fontSize: 24, color: INK_MUTED, letterSpacing: '.02em' }}>
            1 / 1.005^12 = 0.9419
          </div>
          {/* §6 — mandatory: the roll arithmetic is labelled wherever it shows. */}
          <div style={{ fontFamily: mono, fontSize: 15, color: INK_FAINT, marginTop: 12 }}>
            illustrative · one roll a month · constant premium · fees ignored
          </div>
        </div>

        {/* ---- beat 5 ---- */}
        <div data-vcentre="1" data-block="count" style={centreBlock}>
          <div
            style={{
              fontFamily: serif,
              fontSize: 340,
              lineHeight: 0.9,
              color: INK,
              display: 'inline-block',
            }}
          >
            2
          </div>
          {/* The only appearance of the accent in the whole film. */}
          <div style={{ height: 4, background: C.accent, margin: '18px auto 0', width: 150 }} />
          <div style={{ fontFamily: mono, fontSize: 20, color: INK_MUTED, marginTop: 26 }}>
            oil-linked instruments on Robinhood Chain
          </div>
        </div>

        {/* ---- beat 6 ---- */}
        <div
          data-vcentre="1"
          data-block="not-a-bad-trade"
          style={{
            ...centreBlock,
            fontFamily: serif,
            fontSize: 72,
            lineHeight: 1.15,
            color: INK,
            maxWidth: 1200,
          }}
        >
          Nothing was lost to a bad trade.
          <br />
          The shape of the curve took it.
        </div>

        {/* ---- beat 7 ---- */}
        <div data-vcentre="1" data-block="card" style={centreBlock}>
          {/* Plain img on purpose: the optimiser adds an async hop a capture
              cannot observe. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/contango-mark.png" alt="" width={63} height={64} style={{ display: 'block', margin: '0 auto' }} />
          <div
            style={{
              fontFamily: mono,
              fontSize: 40,
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              color: INK,
              marginTop: 26,
            }}
          >
            Contango
          </div>
          <div style={{ fontFamily: serif, fontSize: 26, color: INK_MUTED, marginTop: 28 }}>
            A terminal for the two oil instruments on Robinhood Chain.
          </div>
          <div style={{ fontFamily: mono, fontSize: 15, color: INK_FAINT, marginTop: 20 }}>
            Not a broker. Not affiliated with Robinhood Markets. Not available in the US.
          </div>
        </div>

        {/* §2 — the loop's seam, over everything including the typography. */}
        <div
          data-black="1"
          style={{ position: 'absolute', inset: 0, background: '#000', opacity: 1, pointerEvents: 'none' }}
        />
      </div>
    </>
  )
}

const leftBlock: CSSProperties = {
  position: 'absolute',
  left: EDGE,
  top: '50%',
  transform: 'translateY(-50%)',
  width: 720,
  fontFamily: serif,
  fontSize: 64,
  lineHeight: 1.15,
  color: '#FFFFFF',
  opacity: 0,
}

const centreBlock: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 1400,
  marginLeft: -700,
  textAlign: 'center',
  transform: 'translateY(-50%)',
  opacity: 0,
}
