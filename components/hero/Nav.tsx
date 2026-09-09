'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { C } from '@/lib/hero.tokens'
import { HERO_CONTENT } from '@/lib/hero.content'

const MONO_SIZE = 'clamp(9px, 0.73vw, 12px)'

/** Intrinsic size of the supplied artwork, cropped to the mark's own bounds. */
const MARK = { width: 542, height: 555 }

/**
 * The lockup: the mark, then the name in plain type.
 *
 * The mark is sized in `em` so it tracks the wordmark through its clamp rather
 * than being pinned to one pixel height, and it is set just above the cap
 * height — a dense geometric shape matched to cap height alone reads as
 * undersized next to letterforms.
 */
function Wordmark() {
  return (
    <Link
      href="/"
      aria-label={`${HERO_CONTENT.brand} — home`}
      className="inline-flex items-center text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
      style={{
        fontSize: 'clamp(13px, 1.06vw, 18px)',
        fontWeight: 500,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        outlineOffset: '3px',
        whiteSpace: 'nowrap',
        gap: '0.52em',
      }}
    >
      <Image
        src="/contango-mark.png"
        alt=""
        width={MARK.width}
        height={MARK.height}
        preload
        style={{ height: '1.06em', width: 'auto', flexShrink: 0 }}
      />
      {HERO_CONTENT.brand}
    </Link>
  )
}

export function Nav() {
  const [open, setOpen] = useState(false)
  const { nav, navCta } = HERO_CONTENT

  return (
    <>
      {/* No background, no blur, no border — and none of that appears on scroll. */}
      <header
        className="fixed inset-x-0 top-0 z-10 flex items-center"
        style={{
          height: 'clamp(40px, 3.24vw, 56px)',
          paddingInline: 'clamp(24px, 9.6vw, 140px)',
        }}
      >
        <Wordmark />

        {/* Centred on the viewport, not on the remaining space in the bar. */}
        <nav
          className="pointer-events-auto absolute left-1/2 hidden -translate-x-1/2 md:flex"
          style={{ gap: 'clamp(18px, 2.5vw, 40px)' }}
          aria-label="Main"
        >
          {nav.map((item) => (
            <a
              key={item}
              href={`/${item.toLowerCase()}`}
              className="font-mono uppercase transition-colors duration-[160ms] hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
              style={{
                fontSize: MONO_SIZE,
                letterSpacing: '.14em',
                color: 'rgba(255,255,255,.62)',
                outlineOffset: '3px',
              }}
            >
              {item}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <a
            href="/spread"
            className="hidden font-mono uppercase transition-colors md:inline-block focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              fontSize: MONO_SIZE,
              letterSpacing: '.14em',
              padding: '6px 12px',
              background: C.navBtnBg,
              color: C.navBtnText,
              borderRadius: 0,
              outlineOffset: '3px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.navBtnBg)}
          >
            {navCta}
          </a>

          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-6 w-6 flex-col justify-center gap-[5px] md:hidden focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{ outlineOffset: '3px' }}
          >
            <span className="block h-px w-full bg-white" />
            <span className="block h-px w-full bg-white" />
          </button>
        </div>
      </header>

      {/* §12 — full-screen mono list below 768. */}
      {open && (
        <div
          className="fixed inset-0 z-20 flex flex-col md:hidden"
          style={{ background: '#050507', paddingInline: 'clamp(24px, 9.6vw, 140px)' }}
        >
          <div className="flex items-center" style={{ height: 'clamp(40px, 3.24vw, 56px)' }}>
            <Wordmark />
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="ml-auto font-mono uppercase text-white"
              style={{ fontSize: MONO_SIZE, letterSpacing: '.14em' }}
            >
              Close
            </button>
          </div>

          <nav className="mt-12 flex flex-col gap-6" aria-label="Main">
            {nav.map((item) => (
              <a
                key={item}
                href={`/${item.toLowerCase()}`}
                onClick={() => setOpen(false)}
                className="font-mono uppercase text-white"
                style={{ fontSize: '16px', letterSpacing: '.14em' }}
              >
                {item}
              </a>
            ))}
            <a
              href="/spread"
              onClick={() => setOpen(false)}
              className="mt-4 self-start font-mono uppercase"
              style={{
                fontSize: '14px',
                letterSpacing: '.14em',
                padding: '10px 16px',
                background: C.navBtnBg,
                color: C.navBtnText,
              }}
            >
              {navCta}
            </a>
          </nav>
        </div>
      )}
    </>
  )
}
