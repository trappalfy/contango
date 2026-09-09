'use client'

import { useEffect, useState } from 'react'
import { HUD_ANCHORS, HUD_POOL } from '@/lib/hero.content'

const FADE_MS = 250

function pickBlock(): string[] {
  const size = 2 + Math.floor(Math.random() * 3) // 2..4 lines
  const start = Math.floor(Math.random() * HUD_POOL.length)
  return Array.from({ length: size }, (_, i) => HUD_POOL[(start + i) % HUD_POOL.length])
}

/**
 * One anchor. Each runs its own timers so the four blocks are never in sync —
 * synchronised fading immediately reads as a UI element rather than as output.
 */
function Anchor({ left, top, delay }: { left: string; top: string; delay: number }) {
  const [lines, setLines] = useState<string[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>

    const cycle = () => {
      if (!alive) return
      setLines(pickBlock())
      setVisible(true)

      const hold = 3000 + Math.random() * 2000 // 3-5s
      timer = setTimeout(() => {
        if (!alive) return
        setVisible(false)
        timer = setTimeout(cycle, FADE_MS)
      }, hold)
    }

    timer = setTimeout(cycle, delay)

    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [delay])

  return (
    <pre
      aria-hidden="true"
      className="pointer-events-none absolute m-0 font-mono"
      style={{
        left,
        top,
        transform: 'translate(-50%, -50%)',
        fontSize: 'max(7px, 0.55vw)',
        color: 'rgba(198,202,225,.34)',
        letterSpacing: '.02em',
        lineHeight: 1.5,
        whiteSpace: 'pre',
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms linear`,
      }}
    >
      {lines.join('\n')}
    </pre>
  )
}

/**
 * §9.6 — debugger output floating around the sphere. Rendered as plain DOM
 * over the canvas: sharper than drei's <Html> and far cheaper.
 */
export function HudLines() {
  const [mounted, setMounted] = useState(false)
  const [anchorCount, setAnchorCount] = useState(4)

  // Content is random, so nothing is rendered until after hydration.
  useEffect(() => {
    setMounted(true)
    const apply = () => setAnchorCount(window.innerWidth < 768 ? 2 : 4)
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])

  if (!mounted) return null

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {HUD_ANCHORS.slice(0, anchorCount).map((anchor, i) => (
        <Anchor key={i} left={anchor.left} top={anchor.top} delay={i * 700} />
      ))}
    </div>
  )
}
