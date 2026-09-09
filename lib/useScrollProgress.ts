'use client'

import { useEffect } from 'react'
import Lenis from 'lenis'
import { clamp01, damp } from './hero.tokens'

/**
 * §10 — the whole hero is a pure function of one number.
 *
 * `raw` is where the pin actually is; `smooth` is the damped value the scene
 * reads. Both live outside React: nothing here may trigger a render, because
 * the scene mutates refs inside useFrame and re-rendering would fight it.
 */
export const scrollState = {
  raw: 0,
  smooth: 0,
  reduced: false,
}

type FrameCallback = (p: number, dt: number) => void

const listeners = new Set<FrameCallback>()

/** Subscribe to the single shared rAF loop. Returns an unsubscribe function. */
export function onHeroFrame(cb: FrameCallback): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Damping coefficient — roughly the 0.12-per-frame lerp the brief asks for. */
const DAMP_LAMBDA = 7.5

/**
 * Installs Lenis, tracks pin progress, and runs the one rAF loop that both the
 * DOM copy and the canvas read from.
 */
export function useScrollProgress(wrapperRef: React.RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    scrollState.reduced = motionQuery.matches

    const onMotionChange = (e: MediaQueryListEvent) => {
      scrollState.reduced = e.matches
    }
    motionQuery.addEventListener('change', onMotionChange)

    // Smooth scrolling is disabled outright under reduced motion.
    const lenis = scrollState.reduced
      ? null
      : new Lenis({ duration: 1.1, smoothWheel: true })

    const measure = () => {
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      // Distance already scrolled inside the pinned wrapper, over the distance
      // the wrapper can travel while its sticky child stays on screen.
      const travel = rect.height - window.innerHeight
      scrollState.raw = travel <= 0 ? 0 : clamp01(-rect.top / travel)
    }

    measure()
    scrollState.smooth = scrollState.raw

    let last = performance.now()
    let frame = 0

    const tick = (time: number) => {
      frame = requestAnimationFrame(tick)
      lenis?.raf(time)

      const dt = Math.min((time - last) / 1000, 0.05)
      last = time

      measure()
      scrollState.smooth = scrollState.reduced
        ? scrollState.raw
        : damp(scrollState.smooth, scrollState.raw, DAMP_LAMBDA, dt)

      for (const cb of listeners) cb(scrollState.smooth, dt)
    }

    frame = requestAnimationFrame(tick)

    window.addEventListener('resize', measure)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      motionQuery.removeEventListener('change', onMotionChange)
      lenis?.destroy()
    }
  }, [wrapperRef])
}
