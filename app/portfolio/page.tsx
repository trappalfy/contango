import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PageHeader } from '@/components/site/PageHeader'
import { loadPair } from '@/components/site/PairBoard'
import { PortfolioPanel, type PriceMap } from '@/components/wallet/PortfolioPanel'
import { Body, Container, Eyebrow, HAIRLINE, Panel, Row, Section } from '@/components/ui/primitives'
import { formatDec } from '@/lib/decimal'
import { RPC_IS_PUBLIC } from '@/lib/chain'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Portfolio - Contango',
  description: 'Your side of the pair, read straight from your own wallet.',
}

/** Server-side prices, handed to the client panel so it can value balances. */
async function Panel_() {
  const loaded = await loadPair()
  const prices: PriceMap = loaded
    ? {
        XOM: formatDec(loaded.pair.equity.tokenPrice, 6),
        USO: formatDec(loaded.pair.fund.tokenPrice, 6),
      }
    : {}

  return <PortfolioPanel prices={prices} />
}

export default function PortfolioPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Portfolio"
        title="Your side of the pair."
        lede="Contango never holds your tokens. There is no vault and no deposit — a rotation is a swap that lands straight in your wallet, so your position is simply what your address holds on Robinhood Chain."
      />

      <Container>
        <Suspense
          fallback={<div style={{ border: `1px solid ${HAIRLINE}`, height: 260 }} aria-hidden="true" />}
        >
          <Panel_ />
        </Suspense>
      </Container>

      <Section>
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-20">
          <div className="flex flex-col gap-6">
            <Eyebrow>How reads work</Eyebrow>
            <h2
              style={{
                fontSize: 'clamp(20px,2.2vw,30px)',
                fontWeight: 400,
                color: '#fff',
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Read-only until you sign.
            </h2>
            <Body wide>
              Connecting exposes an address, nothing more. Balances come from one multicall against
              the token contracts, and the multiplier for each stock token comes along in the same
              round trip so a position is never valued off a raw balance alone.
            </Body>
          </div>

          <Panel>
            <Eyebrow>Configuration</Eyebrow>
            <div className="mt-5">
              <Row label="Chain" value="Robinhood Chain · 4663" />
              <Row label="RPC" value={RPC_IS_PUBLIC ? 'Public endpoint' : 'Configured provider'} />
              <Row label="Connector" value="Injected browser wallet" />
              <Row label="Reads" value="balanceOf · uiMultiplier" />
            </div>
            {RPC_IS_PUBLIC && (
              <p
                style={{
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.42)',
                  marginTop: 18,
                }}
              >
                Running against the public RPC, which the chain docs rate-limit and do not
                recommend for production. Set NEXT_PUBLIC_RPC_URL to an Alchemy endpoint to switch.
              </p>
            )}
          </Panel>
        </div>
      </Section>

      <Section>
        <Eyebrow>What you sign</Eyebrow>
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
          Two prompts, and what each one grants.
        </h2>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <Panel>
            <Eyebrow>1 · The permit</Eyebrow>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', marginTop: 14 }}>
              A signature, not a transaction. It costs nothing, sends nothing, and authorises the
              router to move exactly the amount you entered, expiring in twenty minutes. These
              tokens implement EIP-2612 — verified against the contracts — so no separate approval
              transaction is needed, which is why a rotation stays a single transaction.
            </p>
          </Panel>

          <Panel>
            <Eyebrow>2 · The rotation</Eyebrow>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', marginTop: 14 }}>
              The only transaction. It swaps one leg for the other and reverts rather than filling
              you outside your slippage tolerance. Contango is never a party to it: the tokens move
              from the pool to your address.
            </p>
          </Panel>
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
          There is no unlimited approval anywhere in this flow and no contract of ours in the path.
          If a prompt ever asks for more than the amount you typed, something is wrong and you
          should reject it.
        </p>
      </Section>
    </main>
  )
}
