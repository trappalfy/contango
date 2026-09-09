import { Suspense } from 'react'
import type { Metadata } from 'next'
import { PairBoard, loadPair } from '@/components/site/PairBoard'
import { BoardSkeleton } from '@/components/site/BoardSkeleton'
import { PageHeader } from '@/components/site/PageHeader'
import { RotateForm } from '@/components/rotate/RotateForm'
import { RatioChart } from '@/components/chart/RatioChart'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { Container, Eyebrow, Panel, Row, Section, Body } from '@/components/ui/primitives'
import { marketSession } from '@/lib/pair'
import { formatDec } from '@/lib/decimal'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Spread - Contango',
  description: 'Live quotes for XOM and USO on Robinhood Chain, and the ratio between them.',
}

async function Reference() {
  const loaded = await loadPair()
  if (!loaded) return null

  const { pair } = loaded
  const session = marketSession()

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel>
        <Eyebrow>Contracts</Eyebrow>
        <div className="mt-5">
          <Row label="Chain" value="Robinhood Chain · 4663" />
          <Row
            label="XOM"
            value={
              <span style={{ fontSize: 11 }}>{pair.equity.contract ?? '—'}</span>
            }
          />
          <Row
            label="USO"
            value={<span style={{ fontSize: 11 }}>{pair.fund.contract ?? '—'}</span>}
          />
          <Row label="Settlement" value="USDG" />
        </div>
      </Panel>

      <Panel>
        <Eyebrow>Session</Eyebrow>
        <div className="mt-5">
          <Row label="Status" value={session.label} />
          <Row label="XOM multiplier" value={formatDec(pair.equity.multiplier, 8)} />
          <Row label="USO multiplier" value={formatDec(pair.fund.multiplier, 8)} />
          <Row label="Round trip" value={`${pair.roundTripBps.toFixed(1)} bps`} />
        </div>
        <p style={{ fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.42)', marginTop: 18 }}>
          {session.detail}
        </p>
      </Panel>
    </div>
  )
}

export default function SpreadPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Spread"
        title="The gap, priced live."
        lede="Both legs quoted from Robinhood's own feed, converted to per-token values using each asset's corporate-action multiplier. The ratio below is what a rotation actually trades against."
        aside={<ConnectButton />}
      />

      <Container>
        <Suspense fallback={<BoardSkeleton />}>
          <PairBoard />
        </Suspense>
      </Container>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(360px,440px)] lg:gap-16">
          <div className="flex flex-col gap-6">
            <Eyebrow>Rotate</Eyebrow>
            <h2
              style={{
                fontSize: 'clamp(20px,2.2vw,30px)',
                fontWeight: 400,
                color: '#fff',
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              One side or the other, never both.
            </h2>
            <Body wide>
              A rotation is a single swap. Capital leaves one leg and arrives in the other, in your
              own wallet, in one transaction — there is no vault to deposit into and no position to
              be liquidated out of.
            </Body>
            <Body wide>
              The form prices against live mid quotes and enforces your slippage tolerance. What it
              cannot yet do is route: pool depth and price impact need an aggregator, and that is
              the single remaining connection.
            </Body>
          </div>

          <RotateForm />
        </div>
      </Section>

      <Section>
        <Eyebrow>Reference</Eyebrow>
        <div className="mt-8">
          <Suspense fallback={null}>
            <Reference />
          </Suspense>
        </div>
      </Section>

      <Section>
        <Eyebrow>History</Eyebrow>
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
          The series nobody sells you.
        </h2>
        <div className="mt-7 max-w-[62ch]">
          <Body wide>
            Robinhood&apos;s feed returns a bid and an ask and nothing else. No market-data vendor
            covers the overnight and weekend hours when these tokens keep trading and the exchange
            does not — so the only way to own that series is to record it, which is what this does.
          </Body>
        </div>

        <div className="mt-10">
          <RatioChart />
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
          Samples live in the server process, so they reset when it restarts — production needs a
          table behind them. Deep history for XOM and USO daily bars still wants a market-data
          provider; this covers the hours that provider will not have.
        </p>
      </Section>

    </main>
  )
}
