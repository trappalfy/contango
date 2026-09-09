'use client'

import { useSyncExternalStore } from 'react'
import { marketSession } from '@/lib/pair'
import { robinhoodChain } from '@/lib/chain'

/**
 * The status lines — §5 of the footer brief.
 *
 * The brief is firm that these report product state and are removed rather
 * than filled with generic copy. The live one is the session behind both legs.
 * The chain id beside it is fixed rather than changing, and is here because it
 * is the one fact a reader needs before connecting anything.
 *
 * The session comes through `useSyncExternalStore` rather than an effect. The
 * clock is an external source, and this is the shape React provides for one:
 * it also gives a distinct server snapshot, which matters because two pages
 * prerender and must not bake in whatever the market was doing at build time.
 */

const MARKER = 6
const POLL_MS = 60_000

/** A string, so successive snapshots compare equal and never loop a render. */
type Snapshot = 'open' | 'closed' | 'unknown'

function subscribe(onChange: () => void): () => void {
  // The open/closed edge moves twice a day; a minute of lag is invisible, and
  // a tighter timer would wake the tab for nothing.
  const timer = setInterval(onChange, POLL_MS)
  return () => clearInterval(timer)
}

const getSnapshot = (): Snapshot => (marketSession().open ? 'open' : 'closed')
const getServerSnapshot = (): Snapshot => 'unknown'

export function FooterStatus() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const lines: (string | null)[] = [
    session === 'unknown'
      ? null
      : session === 'open'
        ? 'NYSE open · both legs price live'
        : 'NYSE closed · last close is the reference',
    `Chain ${robinhoodChain.id}`,
  ]

  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label="Product status">
      {lines.map((line, index) => (
        <li
          key={index}
          className="font-mono uppercase"
          style={{
            fontSize: 11,
            letterSpacing: '.08em',
            color: 'var(--color-fg-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            // §5 — 25px of leading. Also holds the row open while the session
            // resolves after hydration, so nothing below it jumps.
            minHeight: 25,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: MARKER,
              height: MARKER,
              flexShrink: 0,
              // §3 — the one place a colour from the field is allowed outside
              // it, because here it indicates state rather than decorating.
              background: line ? 'var(--color-pc-4)' : 'transparent',
            }}
          />
          {line ?? ''}
        </li>
      ))}
    </ul>
  )
}
