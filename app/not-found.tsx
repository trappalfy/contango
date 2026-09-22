import Link from 'next/link'
import type { Metadata } from 'next'
import { Body, Container, Eyebrow, Section } from '@/components/ui/primitives'
import { PUBLIC_ROUTES } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Not found - Contango',
  robots: { index: false, follow: false },
}

const LABELS: Record<string, string> = {
  '/': 'Home',
  '/spread': 'Spread',
  '/decay': 'Decay',
  '/portfolio': 'Portfolio',
  '/docs': 'Docs',
}

/**
 * The root 404.
 *
 * It offers the whole site rather than a single "go home" button, because
 * someone who landed here from a stale link usually wants a specific page and
 * knows which one when they see the list.
 */
export default function NotFound() {
  return (
    <Section>
      <Container>
        <Eyebrow>404</Eyebrow>
        <h1
          style={{
            fontSize: 'clamp(30px, 5vw, 62px)',
            fontWeight: 400,
            color: '#fff',
            marginTop: 22,
            lineHeight: 1.05,
          }}
        >
          That page is not here.
        </h1>
        <Body wide>
          The address does not match anything on this site. Nothing has broken — the link was
          probably built by hand, or it points at something that never existed.
        </Body>

        <nav className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
          {PUBLIC_ROUTES.map((route) => (
            <Link
              key={route}
              href={route}
              className="font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
              style={{
                fontSize: 11,
                letterSpacing: '.14em',
                color: 'rgba(255,255,255,0.62)',
                outlineOffset: 3,
              }}
            >
              {LABELS[route]}
            </Link>
          ))}
        </nav>
      </Container>
    </Section>
  )
}
