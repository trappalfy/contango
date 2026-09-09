import type { ReactNode } from 'react'
import { C } from '@/lib/hero.tokens'

/**
 * The shared vocabulary for everything below the hero.
 *
 * The hero fixes the language: a serif for display, its companion sans for
 * running text, a mono for every number, square corners, one accent, and a big
 * gap between display type and the mono labels around it. These keep the rest
 * of the site inside that language instead of re-deciding it per page.
 */

/** Matches the hero's horizontal rhythm exactly (§5 of the brief). */
export const PAGE_PADDING = 'clamp(24px, 9.6vw, 140px)'

export const HAIRLINE = 'rgba(255,255,255,0.09)'

export function Container({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={className} style={{ paddingInline: PAGE_PADDING }}>
      {children}
    </div>
  )
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p
      className="font-mono uppercase"
      style={{
        fontSize: 'clamp(9px, 0.73vw, 12px)',
        letterSpacing: '.14em',
        color: C.textMuted,
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

export function Display({
  children,
  as: Tag = 'h2',
  measure,
}: {
  children: ReactNode
  as?: 'h1' | 'h2' | 'h3'
  /**
   * Line length in characters. Applied to the heading itself, not a wrapper:
   * `ch` resolves against the element's own font size, so putting it on a
   * parent would measure it against body text and clamp far too tightly.
   */
  measure?: number
}) {
  return (
    <Tag
      className="text-[26px] md:text-[clamp(28px,3.2vw,48px)]"
      style={{
        fontWeight: 400,
        lineHeight: 1.04,
        letterSpacing: '-0.015em',
        color: C.textPrimary,
        margin: 0,
        maxWidth: measure ? `${measure}ch` : undefined,
      }}
    >
      {children}
    </Tag>
  )
}

export function Body({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <p
      style={{
        fontSize: 'clamp(13px, 1.05vw, 16px)',
        lineHeight: 1.55,
        color: 'rgba(255,255,255,0.62)',
        maxWidth: wide ? '68ch' : '52ch',
        margin: 0,
      }}
    >
      {children}
    </p>
  )
}

export function Rule() {
  return <div aria-hidden="true" style={{ height: 1, background: HAIRLINE }} />
}

/** A bordered block. Square corners, no shadow, no radius — see §7. */
export function Panel({
  children,
  accent = false,
}: {
  children: ReactNode
  accent?: boolean
}) {
  return (
    <div
      style={{
        border: `1px solid ${accent ? 'rgba(63,71,255,0.45)' : HAIRLINE}`,
        background: accent ? 'rgba(63,71,255,0.06)' : 'rgba(255,255,255,0.015)',
        padding: 'clamp(18px, 2vw, 28px)',
      }}
    >
      {children}
    </div>
  )
}

/** A number with its label. Numbers are always mono and tabular. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'accent' | 'muted'
}) {
  const color =
    tone === 'accent' ? '#8E93FF' : tone === 'muted' ? 'rgba(255,255,255,0.46)' : C.textPrimary

  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div
        className="font-mono"
        style={{
          fontSize: 'clamp(18px, 1.9vw, 28px)',
          fontVariantNumeric: 'tabular-nums',
          color,
          marginTop: 10,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {hint && (
        <div
          className="font-mono"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 6 }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

/** Label/value row for dense reference tables. */
export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div
      className="flex items-baseline justify-between gap-6 py-3"
      style={{ borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <span
        className="font-mono uppercase"
        style={{ fontSize: 11, letterSpacing: '.12em', color: 'rgba(255,255,255,0.46)' }}
      >
        {label}
      </span>
      <span
        className="font-mono text-right"
        style={{
          fontSize: 13,
          color: C.textPrimary,
          fontVariantNumeric: 'tabular-nums',
          // A flex item will not shrink below its content unless told to, so a
          // 42-character contract address pushes the whole panel past the
          // viewport on a phone. These two let it wrap instead.
          minWidth: 0,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
    </div>
  )
}

/** A live/stale/closed indicator. */
export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'live' | 'warn' | 'neutral'
}) {
  const map = {
    live: { border: 'rgba(120,220,170,0.45)', color: '#8FE6BE' },
    warn: { border: 'rgba(252,168,224,0.45)', color: C.particleHot },
    neutral: { border: HAIRLINE, color: 'rgba(255,255,255,0.55)' },
  }[tone]

  return (
    <span
      className="font-mono uppercase"
      style={{
        fontSize: 10,
        letterSpacing: '.14em',
        border: `1px solid ${map.border}`,
        color: map.color,
        padding: '4px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}

export function CtaLink({
  href,
  children,
  variant = 'accent',
}: {
  href: string
  children: ReactNode
  variant?: 'accent' | 'light'
}) {
  const style =
    variant === 'accent'
      ? { background: C.accent, color: '#fff' }
      : { background: C.navBtnBg, color: C.navBtnText }

  return (
    <a
      href={href}
      className="inline-flex items-center font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
      style={{
        ...style,
        fontSize: 'clamp(9px, 0.73vw, 12px)',
        letterSpacing: '.14em',
        padding: '9px 16px',
        borderRadius: 0,
        outlineOffset: '3px',
      }}
    >
      {children}
      <span
        aria-hidden="true"
        style={{
          marginLeft: 8,
          width: 0,
          height: 0,
          borderTop: '4px solid transparent',
          borderBottom: '4px solid transparent',
          borderLeft: `4px solid ${variant === 'accent' ? '#fff' : C.navBtnText}`,
        }}
      />
    </a>
  )
}

/** Standard vertical rhythm for a page section. */
export function Section({
  children,
  id,
  border = true,
}: {
  children: ReactNode
  id?: string
  border?: boolean
}) {
  return (
    <section
      id={id}
      style={{
        borderTop: border ? `1px solid ${HAIRLINE}` : undefined,
        paddingBlock: 'clamp(56px, 8vw, 120px)',
      }}
    >
      <Container>{children}</Container>
    </section>
  )
}
