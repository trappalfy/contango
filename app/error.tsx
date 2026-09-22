'use client'

import { useEffect } from 'react'
import { Body, Container, Eyebrow, Section } from '@/components/ui/primitives'

/**
 * The segment error boundary.
 *
 * Every page on this site reads a live feed that rate-limits hard, so the
 * realistic failure here is transient and a retry is the right offer. The
 * digest is shown because it is the only handle anyone has on a server error
 * whose message React deliberately withholds from the browser.
 *
 * In Next 16 the recovery prop is `retry`; it was `reset` before.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    // No reporting service is wired up yet, so this is the whole trail.
    console.error(error)
  }, [error])

  return (
    <Section>
      <Container>
        <Eyebrow>Error</Eyebrow>
        <h1
          style={{
            fontSize: 'clamp(30px, 5vw, 62px)',
            fontWeight: 400,
            color: '#fff',
            marginTop: 22,
            lineHeight: 1.05,
          }}
        >
          This page did not load.
        </h1>
        <Body wide>
          Something failed while rendering. No transaction is affected by this — the site holds no
          funds and signs nothing on its own.
        </Body>

        <div className="mt-10 flex flex-wrap items-center gap-6">
          <button
            type="button"
            onClick={() => retry()}
            className="font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              fontSize: 11,
              letterSpacing: '.14em',
              color: '#fff',
              background: '#3F47FF',
              padding: '12px 22px',
              outlineOffset: 3,
            }}
          >
            Try again
          </button>

          {error.digest && (
            <span
              className="font-mono"
              style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}
            >
              digest {error.digest}
            </span>
          )}
        </div>
      </Container>
    </Section>
  )
}
