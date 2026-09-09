'use client'

import { Fragment, useEffect, useRef } from 'react'
import {
  COPY_A_OPACITY,
  COPY_B_OPACITY,
  C,
  easeOutQuad,
  sampleTrack,
} from '@/lib/hero.tokens'
import { HERO_CONTENT } from '@/lib/hero.content'
import { onHeroFrame } from '@/lib/useScrollProgress'

/** Hard line breaks — §7 is explicit that the copy must not wrap to width. */
function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  )
}

/**
 * §7 — both states live in the same container and cross only through opacity.
 * No translate, no blur.
 *
 * Opacity is written straight to the DOM from the shared rAF loop; putting it
 * in React state would re-render the tree sixty times a second for nothing.
 */
export function HeroCopy() {
  const stateARef = useRef<HTMLDivElement>(null)
  const stateBRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const apply = (el: HTMLElement | null, opacity: number) => {
      if (!el) return
      el.style.opacity = String(opacity)
      el.style.pointerEvents = opacity > 0.5 ? 'auto' : 'none'
      el.setAttribute('aria-hidden', opacity > 0.5 ? 'false' : 'true')
    }

    return onHeroFrame((p) => {
      apply(stateARef.current, sampleTrack(COPY_A_OPACITY, p, easeOutQuad))
      apply(stateBRef.current, sampleTrack(COPY_B_OPACITY, p, easeOutQuad))
    })
  }, [])

  const { h1, sub, bLead, bBody, bCta } = HERO_CONTENT

  return (
    <div className="pointer-events-none absolute inset-0 z-[2]">
      {/* ---------------- State A ---------------- */}
      <div ref={stateARef} style={{ opacity: 1 }}>
        <h1
          className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center text-[34px] md:text-[clamp(44px,5.35vw,56px)] xl:text-[clamp(38px,5.35vw,88px)]"
          style={{
            fontWeight: 400,
            lineHeight: 0.95,
            letterSpacing: '-0.015em',
            color: C.textPrimary,
            paddingInline: 'clamp(16px, 4vw, 40px)',
          }}
        >
          <Lines lines={h1} />
        </h1>

        {/* Not under the headline — pinned to the bottom edge. The size gap
            against the h1 is part of the image and must not be evened out. */}
        <p
          className="absolute left-1/2 bottom-[40px] max-w-[80vw] -translate-x-1/2 text-center text-[11px] md:bottom-[7.6svh] md:max-w-[44vw] md:text-[clamp(11px,0.9vw,14px)] xl:max-w-[23vw]"
          style={{ lineHeight: 1.45, color: C.textMuted }}
        >
          <Lines lines={sub} />
        </p>
      </div>

      {/* ---------------- State B ---------------- */}
      <div
        ref={stateBRef}
        className="absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
        style={{ opacity: 0, paddingInline: 'clamp(16px, 4vw, 40px)' }}
      >
        <p
          className="font-display text-[22px] md:text-[clamp(22px,2.6vw,40px)]"
          style={{ fontWeight: 400, color: C.textPrimary, lineHeight: 1.03 }}
        >
          {bLead}
        </p>

        {/* Same type size as the lead — measured, not assumed. */}
        <p
          className="font-display mt-[3.6vw] max-w-[88vw] text-[20px] md:max-w-[56.4vw] md:text-[clamp(22px,2.6vw,40px)]"
          style={{ fontWeight: 400, color: C.textPrimary, lineHeight: 1.03 }}
        >
          <Lines lines={bBody} />
        </p>

        <a
          href="/spread"
          className="mt-6 inline-flex items-center font-mono uppercase text-white transition-[filter] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
          style={{
            fontSize: 'clamp(9px, 0.73vw, 12px)',
            letterSpacing: '.14em',
            padding: '7px 14px',
            background: C.accent,
            borderRadius: 0,
            outlineOffset: '3px',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
          onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
        >
          {bCta}
          <span
            aria-hidden="true"
            style={{
              marginLeft: 8,
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderLeft: `4px solid ${C.textPrimary}`,
            }}
          />
        </a>
      </div>
    </div>
  )
}
