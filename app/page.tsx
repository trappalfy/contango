import { Suspense } from 'react'
import { Hero } from '@/components/hero/Hero'
import { PairBoard } from '@/components/site/PairBoard'
import { BoardSkeleton } from '@/components/site/BoardSkeleton'
import {
  Body,
  CtaLink,
  Display,
  Eyebrow,
  HAIRLINE,
  Panel,
  Section,
} from '@/components/ui/primitives'

export const dynamic = 'force-dynamic'

const DRIFT = [
  {
    title: 'The fund pays to stay long',
    body: 'USO never touches a barrel. It holds front-month futures and must sell them before delivery to buy the next month. When the far month costs more than the near one — contango — every roll buys back less exposure than it sold.',
  },
  {
    title: 'The company gets paid to sell',
    body: 'XOM owns reserves, refineries and contracts. Its earnings move with crude, but it carries no roll, and what it returns to holders arrives as a dividend rather than as a drag.',
  },
  {
    title: 'So the ratio has a floor and a drift',
    body: 'Both instruments track the same commodity, so they move together day to day. But one leaks value on a schedule and the other accrues it, which gives the ratio a structural tilt on top of the noise.',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Read the gap',
    body: 'Live quotes for both legs, the spread you pay to cross each one, and where the ratio sits against its own history.',
  },
  {
    n: '02',
    title: 'Take one side',
    body: 'Capital sits in XOM or in USO, never both. Rotation is a single swap routed through 1inch on Robinhood Chain.',
  },
  {
    n: '03',
    title: 'Keep custody',
    body: 'Tokens go straight to your wallet. There is no vault, no deposit and no contract of ours holding anything.',
  },
]

export default function Home() {
  return (
    <main>
      <Hero />

      <Section id="spread">
        <Eyebrow>The pair</Eyebrow>
        <div className="mt-6">
          <Display measure={18}>Same barrel, two machines.</Display>
        </div>
        <div className="mt-7 max-w-[62ch]">
          <Body wide>
            These are the only two oil-linked instruments listed on Robinhood Chain. Everything
            here is read live from the chain&apos;s own asset registry and quote feed.
          </Body>
        </div>

        <div className="mt-12">
          <Suspense fallback={<BoardSkeleton />}>
            <PairBoard />
          </Suspense>
        </div>

        <div className="mt-10">
          <CtaLink href="/spread">Open the terminal</CtaLink>
        </div>
      </Section>

      <Section id="decay">
        <Eyebrow>Why they drift</Eyebrow>
        <div className="mt-6">
          <Display measure={20}>One of them leaks on a schedule.</Display>
        </div>

        <div className="mt-14 grid gap-px md:grid-cols-3" style={{ background: HAIRLINE }}>
          {DRIFT.map((item) => (
            <div key={item.title} style={{ background: '#030305', padding: 'clamp(20px,2.4vw,34px)' }}>
              <h3
                style={{
                  fontSize: 'clamp(15px,1.35vw,19px)',
                  fontWeight: 400,
                  color: '#fff',
                  margin: 0,
                  lineHeight: 1.25,
                }}
              >
                {item.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: 14,
                }}
              >
                {item.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <CtaLink href="/decay" variant="light">
            See the mechanism
          </CtaLink>
        </div>
      </Section>

      <Section>
        <Eyebrow>How it works</Eyebrow>
        <div className="mt-6">
          <Display measure={16}>Three moves, no custody.</Display>
        </div>

        <div className="mt-14 grid gap-10 md:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n}>
              <span
                className="font-mono"
                style={{ fontSize: 11, letterSpacing: '.14em', color: '#8E93FF' }}
              >
                {step.n}
              </span>
              <h3
                style={{
                  fontSize: 'clamp(16px,1.5vw,21px)',
                  fontWeight: 400,
                  color: '#fff',
                  marginTop: 16,
                  marginBottom: 0,
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: 'rgba(255,255,255,0.55)',
                  marginTop: 12,
                }}
              >
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-20">
          <div>
            <Eyebrow>Limits</Eyebrow>
            <div className="mt-6">
              <Display>What this is not.</Display>
            </div>
          </div>

          <Panel>
            <ul className="flex flex-col gap-5" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {[
                'There is no short leg. No borrow market for stock tokens exists on Robinhood Chain, so a true long/short pair trade cannot be assembled. Capital rotates between the legs instead.',
                'No leverage, no margin, no liquidation. You hold spot tokens in your own wallet.',
                'Stock Tokens are not available in the United States. Availability depends on your jurisdiction.',
                'Nothing here is advice. The ratio has behaved a certain way historically; that is not a claim about tomorrow.',
              ].map((item) => (
                <li
                  key={item}
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: 'rgba(255,255,255,0.62)',
                    paddingLeft: 18,
                    position: 'relative',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 8,
                      width: 5,
                      height: 5,
                      background: 'rgba(255,255,255,0.28)',
                    }}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </Section>
    </main>
  )
}
