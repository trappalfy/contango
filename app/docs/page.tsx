import type { Metadata } from 'next'
import { PageHeader } from '@/components/site/PageHeader'
import { Body, Eyebrow, Panel, Row, Section } from '@/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Docs - Contango',
  description:
    'How Contango reads Robinhood Chain, where its numbers come from, and what it deliberately does not claim.',
}

const RISKS = [
  {
    title: 'A stock token is not a share',
    body: 'It is an instrument that tracks one. It carries no voting rights, and you depend on the issuer honouring redemption. That counterparty exposure sits underneath everything else on this site.',
  },
  {
    title: 'The market closes; the token does not',
    body: 'From Friday afternoon to Monday morning the only agreed reference is the last close. Prices quoted onchain in that window reflect thin liquidity and wrapper risk as much as they reflect oil.',
  },
  {
    title: 'Two instruments is not diversification',
    body: 'Rotating between XOM and USO keeps you fully exposed to crude at all times. It changes which machinery you hold, not whether you are long oil.',
  },
  {
    title: 'The chain is young',
    body: 'Robinhood Chain launched on 1 July 2026 and stopped producing blocks for several minutes in September. Treat availability as something that can fail.',
  },
]

export default function DocsPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Docs"
        title="Where the numbers come from."
        lede="Everything shown on this site is read from public endpoints. This page lists them, explains the one conversion that is easy to get wrong, and states plainly what is not implemented."
      />

      <Section id="data">
        <Eyebrow>Data sources</Eyebrow>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Panel>
            <h3
              className="font-mono uppercase"
              style={{ fontSize: 11, letterSpacing: '.14em', color: '#fff', margin: 0 }}
            >
              Live, wired up
            </h3>
            <div className="mt-5">
              <Row label="/rhj/assets" value="Registry, contracts, multipliers" />
              <Row label="/rhj/prices" value="All quotes, one request" />
              <Row label="/rhj/corporate-actions" value="Dividends and splits" />
              <Row label="Cache" value="20s quotes · 1h registry" />
            </div>
          </Panel>

          <Panel>
            <h3
              className="font-mono uppercase"
              style={{ fontSize: 11, letterSpacing: '.14em', color: '#fff', margin: 0 }}
            >
              Not wired up
            </h3>
            <div className="mt-5">
              <Row label="Price history" value="Needs a market-data provider" />
              <Row label="Futures curve" value="Needs a commodity source" />
              <Row label="Balances" value="Needs an RPC key" />
              <Row label="Rotation" value="Needs a 1inch key" />
            </div>
          </Panel>
        </div>

        <p
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.42)',
            marginTop: 20,
            maxWidth: '72ch',
          }}
        >
          The quote endpoint rate-limits hard — a second call a moment later returns
          429 local_rate_limited. Requests are therefore cached in the server process, shared while
          in flight, and a failed refresh falls back to the last good response rather than erroring
          the page. That is what the &ldquo;Cached&rdquo; badge means when you see it.
        </p>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-20">
          <div>
            <Eyebrow>The conversion that matters</Eyebrow>
            <h2
              style={{
                fontSize: 'clamp(20px,2.2vw,30px)',
                fontWeight: 400,
                color: '#fff',
                marginTop: 20,
                lineHeight: 1.15,
              }}
            >
              Raw quotes are not token prices.
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            <Body wide>
              Stock tokens are ordinary ERC-20s, but splits and dividends are applied through a
              multiplier rather than by changing balances. One token represents
              currentMultiplier underlying shares.
            </Body>
            <Body wide>
              The REST feed returns the raw underlying bid and ask, unadjusted. The onchain
              Chainlink feed is adjusted. Mixing the two without converting is how an integration
              ends up double-counting a split — or, on the day one lands, liquidating a position
              that was never underwater. Every price on this site is multiplied once, in one place,
              and nowhere else.
            </Body>
            <Body wide>
              This is not hypothetical. CRWD already sits at a multiplier of exactly 4.0 after a
              four-for-one split, and dividend payers drift upward every quarter.
            </Body>
          </div>
        </div>
      </Section>

      <Section id="risk">
        <Eyebrow>Risk</Eyebrow>
        <h2
          style={{
            fontSize: 'clamp(20px,2.2vw,30px)',
            fontWeight: 400,
            color: '#fff',
            marginTop: 20,
            marginBottom: 0,
            lineHeight: 1.15,
          }}
        >
          What can go against you.
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {RISKS.map((risk) => (
            <Panel key={risk.title}>
              <h3
                style={{
                  fontSize: 'clamp(15px,1.35vw,18px)',
                  fontWeight: 400,
                  color: '#fff',
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {risk.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: 12,
                }}
              >
                {risk.body}
              </p>
            </Panel>
          ))}
        </div>

        <p
          style={{
            fontSize: 12,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.42)',
            marginTop: 24,
            maxWidth: '72ch',
          }}
        >
          Contango is an interface over public data. It is not a broker, not an issuer, not
          affiliated with Robinhood Markets, and nothing here is investment advice. Stock Tokens
          are not available in the United States, and availability elsewhere depends on your
          jurisdiction.
        </p>
      </Section>
    </main>
  )
}
