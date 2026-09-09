import Link from 'next/link'
import { HERO_CONTENT } from '@/lib/hero.content'
import { SymbolField } from '@/components/site/SymbolField'
import { SubscribeForm } from '@/components/site/SubscribeForm'
import { FooterStatus } from '@/components/site/FooterStatus'

/**
 * The footer — docs/footer-brief.md.
 *
 * A full-height final screen rather than a strip under the content, so it is
 * laid out against the section's own height and width in the percentages the
 * brief measures, not against the page container. §4 is explicit that it
 * reaches the edges: the side padding is 2.3%, against 1132px of container
 * everywhere else.
 *
 * Two layouts, not one. From md up the section is a composed screen and the
 * field, copyright and wordmark are positioned absolutely inside it. Below
 * that they take their turn in the flow, because §10 puts everything in one
 * column and that column is taller than the third of the height the band would
 * start at — an absolute band would be laid straight across the text.
 *
 * DOM order is the mobile order: columns, then field, then wordmark. The
 * desktop stack is held by z-index instead, which is why the wordmark can sit
 * under the field while coming after it in the markup.
 */

/** §4 — the section is measured in percentages of itself, not of the page. */
const SIDE = '2.3%'

/** §6 — real destinations only; the chain links are the ones that exist. */
const CHAIN_LINKS = [
  { label: 'Robinhood Chain', href: 'https://robinhood.com/us/en/chain/' },
  { label: 'Explorer', href: 'https://robinhoodchain.blockscout.com' },
  { label: 'Chain docs', href: 'https://docs.robinhood.com/chain/' },
]

/** §6 — the heavier pair. Both point at sections that exist on this site. */
const LEGAL_LINKS = [
  { label: 'Risk', href: '/docs#risk' },
  { label: 'Data sources', href: '/docs#data' },
]

/** §8 — three lines, and every one of them is a statement we can stand behind. */
const COPY = [
  'Contango is an interface over public data.',
  'Not a broker, not an issuer, not affiliated with Robinhood.',
  'Stock Tokens are not available in the United States.',
]

export function Footer() {
  return (
    <footer
      className="relative isolate overflow-hidden"
      style={{ minHeight: '100svh', paddingInline: SIDE, background: '#030305' }}
    >
      {/* ---------------- the columns ---------------- */}
      <div
        className="relative z-20 grid gap-y-12 md:grid-cols-[24.1%_1fr] md:gap-x-[6%] md:gap-y-0 lg:grid-cols-[24.1%_51.9%_24%] lg:gap-x-0"
        style={{ paddingTop: 'clamp(40px, 5.1svh, 60px)' }}
      >
        <div className="md:col-start-1 md:row-start-1">
          <SubscribeForm title="Watch the gap, not the screen." />
        </div>

        {/*
          The corridor §4 asks for. It used to be the space between the menu
          and this column; with the menu gone it is the whole middle, and the
          contacts still start on the brief's 74.8% of the section.
        */}
        <div aria-hidden="true" className="hidden lg:col-start-2 lg:row-start-1 lg:block" />

        <div className="flex flex-col md:col-start-2 md:row-start-1 lg:col-start-3">
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {CHAIN_LINKS.map((link) => (
              <li key={link.label} style={{ lineHeight: '27px' }}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="footer-thin focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
                  style={{ fontSize: 14, fontWeight: 400, outlineOffset: '3px' }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0, marginTop: 24 }}>
            {LEGAL_LINKS.map((link) => (
              <li key={link.label} style={{ lineHeight: '25px' }}>
                <Link
                  href={link.href}
                  className="footer-thin focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
                  style={{ fontSize: 14, fontWeight: 600, outlineOffset: '3px' }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/*
          §10 — last in the single column on a phone, and back under the form
          from md up, where the brief puts it at 25% of the section's height.
        */}
        <div className="order-last md:order-none md:col-start-1 md:row-start-2 md:mt-6">
          <FooterStatus />
        </div>
      </div>

      {/* §7 and §8 — the field, and the copyright standing in its gap. */}
      <div className="pointer-events-none relative z-10 mt-14 h-[46svh] md:absolute md:inset-x-0 md:top-[33.4%] md:mt-0 md:h-[44.6%]">
        <SymbolField className="absolute inset-0 h-full w-full" />

        {/*
          Vertically centred in the band on a phone, where the two curves stack
          and leave a horizontal gap across the middle. From md up the gap is a
          vertical corridor, so the text takes the brief's own 46.3% of the
          section — 28.9% of the way down this band.
        */}
        <div className="absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 justify-center md:top-[28.9%] md:translate-y-0">
          <div
            className="relative flex items-center justify-center text-center"
            style={{ width: 'min(392px, 84%)', minHeight: 72 }}
          >
            {/* Darkens the cells behind the text without putting a panel there. */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                inset: '-70px -60px',
                background:
                  'radial-gradient(closest-side, rgba(3,3,5,0.97) 0%, rgba(3,3,5,0.9) 46%, rgba(3,3,5,0) 100%)',
              }}
            />
            <p
              className="relative"
              style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--color-fg-muted)', margin: 0 }}
            >
              {COPY.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </p>
          </div>
        </div>
      </div>

      {/*
        §9 — under the field, cropped by the bottom edge.
        On a phone the crop is its own overflow box, and deeper, per §10.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative z-0 mt-10 h-[7.4vw] overflow-hidden md:absolute md:inset-x-0 md:top-[74.9%] md:mt-0 md:h-auto md:overflow-visible"
        style={{ paddingInline: SIDE }}
      >
        <span
          className="footer-wordmark block text-center"
          style={{
            color: 'var(--color-footer-mark)',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 0.78,
            whiteSpace: 'nowrap',
          }}
        >
          {HERO_CONTENT.brand}
        </span>
      </div>
    </footer>
  )
}
