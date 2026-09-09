'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { BG_CSS, PIN_HEIGHT_SVH } from '@/lib/hero.tokens'
import { useScrollProgress } from '@/lib/useScrollProgress'
import { HeroCopy } from './HeroCopy'
import { HudLines } from './Sphere/HudLines'

// WebGL never runs on the server; the copy underneath it does.
const HeroCanvas = dynamic(() => import('./HeroCanvas'), { ssr: false })

/** §8 — tileable noise, generated inline so there is no asset to fetch. */
const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='128' height='128' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function Hero() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(true)

  useScrollProgress(wrapperRef)

  // §13 — stop rendering entirely once the pinned section is off screen.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { threshold: 0 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      {/* The pin: a tall wrapper whose sticky child holds the viewport.
          Its height is the scroll-to-camera gearing — see PIN_HEIGHT_SVH. */}
      <div ref={wrapperRef} data-hero-pin style={{ height: `${PIN_HEIGHT_SVH}svh` }}>
        <section
          className="sticky top-0 overflow-hidden"
          style={{ height: '100svh' }}
          aria-label="Contango — oil exposure onchain"
        >
          {/* 1. background */}
          <div className="absolute inset-0 z-0" style={{ background: BG_CSS }} />

          {/* 2. canvas + the debugger output that floats with it */}
          <div className="absolute inset-0 z-[1]">
            <HeroCanvas active={active} />
            <HudLines />
          </div>

          {/* 3. copy — deliberately overlapped by the sphere, with no scrim */}
          <HeroCopy />

          {/* 4. grain, over everything, to kill gradient banding */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[3]"
            style={{
              backgroundImage: GRAIN_URL,
              backgroundRepeat: 'repeat',
              opacity: 0.035,
              mixBlendMode: 'overlay',
            }}
          />
        </section>
      </div>
    </>
  )
}
