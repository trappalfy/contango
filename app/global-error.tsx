'use client'

/**
 * The last resort: the root layout itself failed.
 *
 * This replaces the layout rather than rendering inside it, so it carries its
 * own `<html>` and `<body>` and cannot reach the site's fonts, tokens or
 * components. Everything here is inline and self-contained on purpose — a
 * fallback that depends on the thing that just broke is not a fallback.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          background: '#030305',
          color: '#fff',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        }}
      >
        <main style={{ padding: '0 clamp(24px, 9.6vw, 140px)', maxWidth: 760 }}>
          <p
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.42)',
              margin: 0,
            }}
          >
            Error
          </p>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 56px)', fontWeight: 400, margin: '22px 0 0', lineHeight: 1.05 }}>
            The site failed to start.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', marginTop: 20 }}>
            This is a failure in the application shell, not in anything you did. The site holds no
            funds and signs nothing on its own, so nothing is at risk while it is down.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 36, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: '#fff',
                background: '#3F47FF',
                border: 0,
                padding: '12px 22px',
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
            {error.digest && (
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>
                digest {error.digest}
              </span>
            )}
          </div>
        </main>
      </body>
    </html>
  )
}
