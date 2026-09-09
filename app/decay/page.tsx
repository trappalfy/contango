import type { Metadata } from 'next'
import { PageHeader } from '@/components/site/PageHeader'
import { Body, Eyebrow, HAIRLINE, Panel, Section, Stat } from '@/components/ui/primitives'

export const metadata: Metadata = {
  title: 'Decay - Contango',
  description:
    'Why a futures-backed oil fund loses ground to the barrel it tracks, and what that costs per year.',
}

/**
 * Annual effect of rolling front-month futures at a constant monthly premium.
 *
 * Each roll sells the near contract and buys the far one, so the same money
 * buys 1 / (1 + premium) of the exposure it had. Twelve rolls compound.
 * A negative premium (backwardation) is a tailwind, not a drag.
 */
function annualRollEffect(monthlyPremiumPct: number): number {
  const factor = 1 / (1 + monthlyPremiumPct / 100)
  return (Math.pow(factor, 12) - 1) * 100
}

const SCENARIOS = [-0.5, 0.5, 1.0, 1.5, 2.0]
const EXAMPLE = { front: 70, next: 71.05 }

const HEAD = ['Monthly premium', 'Curve shape', 'Exposure kept per roll', 'Effect over 12 rolls']

export default function DecayPage() {
  const exampleRatio = EXAMPLE.front / EXAMPLE.next
  const examplePremium = (EXAMPLE.next / EXAMPLE.front - 1) * 100
  const exampleAnnual = annualRollEffect(examplePremium)

  return (
    <main>
      <PageHeader
        eyebrow="Decay"
        title="The roll is not free."
        lede="A fund that holds crude futures cannot simply keep them. Every month it sells the contract about to expire and buys the next one along. When the next one costs more, that trade quietly shrinks the position — and it happens whether or not the price of oil moves at all."
      />

      <Section>
        <div className="grid gap-12 md:grid-cols-[1.05fr_1fr] md:gap-20">
          <div className="flex flex-col gap-6">
            <Eyebrow>The mechanism</Eyebrow>
            <Body wide>
              Suppose the expiring contract trades at ${EXAMPLE.front.toFixed(2)} and the following
              month at ${EXAMPLE.next.toFixed(2)}. The fund sells one and buys the other, so the
              same money now controls {exampleRatio.toFixed(4)} of the barrels it controlled a
              moment earlier. Nothing was lost to a bad trade. The shape of the curve took it.
            </Body>
            <Body wide>
              Repeat that twelve times and compounding does the rest. This is why a chart of an oil
              fund and a chart of crude itself separate over years even though they move together
              day to day.
            </Body>
          </div>

          <Panel accent>
            <div className="flex flex-col gap-8">
              <Stat
                label="Monthly premium here"
                value={`${examplePremium.toFixed(2)}%`}
                hint={`$${EXAMPLE.front.toFixed(2)} to $${EXAMPLE.next.toFixed(2)}`}
              />
              <Stat
                label="Exposure kept per roll"
                value={exampleRatio.toFixed(4)}
                hint="Of the position held before it"
                tone="accent"
              />
              <Stat
                label="After twelve rolls"
                value={`${exampleAnnual.toFixed(1)}%`}
                hint="With oil itself unchanged"
                tone="accent"
              />
            </div>
          </Panel>
        </div>
      </Section>

      <Section>
        <Eyebrow>At other curve shapes</Eyebrow>
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
          The drag scales with the premium, and reverses when the curve does.
        </h2>

        <div className="mt-12 overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 520 }}>
            <thead>
              <tr>
                {HEAD.map((h) => (
                  <th
                    key={h}
                    className="font-mono uppercase"
                    style={{
                      textAlign: 'left',
                      fontSize: 10,
                      letterSpacing: '.14em',
                      color: 'rgba(255,255,255,0.46)',
                      fontWeight: 400,
                      padding: '0 16px 14px 0',
                      borderBottom: `1px solid ${HAIRLINE}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCENARIOS.map((premium) => {
                const effect = annualRollEffect(premium)
                const kept = 1 / (1 + premium / 100)
                const tailwind = effect > 0
                const cell = {
                  padding: '14px 16px 14px 0',
                  borderBottom: `1px solid ${HAIRLINE}`,
                  fontSize: 13,
                } as const
                return (
                  <tr key={premium}>
                    <td
                      className="font-mono"
                      style={{ ...cell, fontVariantNumeric: 'tabular-nums', color: '#fff' }}
                    >
                      {premium > 0 ? '+' : ''}
                      {premium.toFixed(1)}%
                    </td>
                    <td style={{ ...cell, color: 'rgba(255,255,255,0.55)' }}>
                      {premium > 0 ? 'Contango' : 'Backwardation'}
                    </td>
                    <td
                      className="font-mono"
                      style={{
                        ...cell,
                        fontVariantNumeric: 'tabular-nums',
                        color: 'rgba(255,255,255,0.72)',
                      }}
                    >
                      {kept.toFixed(4)}
                    </td>
                    <td
                      className="font-mono"
                      style={{
                        ...cell,
                        fontVariantNumeric: 'tabular-nums',
                        color: tailwind ? '#8FE6BE' : '#FCA8E0',
                      }}
                    >
                      {effect > 0 ? '+' : ''}
                      {effect.toFixed(2)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
          Illustrative arithmetic, not a measurement. It assumes one roll a month at a constant
          premium and ignores fees. Real curves change shape constantly, and in 2020 the front
          month went negative. Measuring the drag that actually occurred needs a futures-curve data
          source, which is not wired up yet.
        </p>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:gap-20">
          <div>
            <Eyebrow>The other side</Eyebrow>
            <h2
              style={{
                fontSize: 'clamp(20px,2.2vw,30px)',
                fontWeight: 400,
                color: '#fff',
                marginTop: 20,
                lineHeight: 1.15,
              }}
            >
              What the equity does instead.
            </h2>
          </div>
          <div className="flex flex-col gap-5">
            <Body wide>
              XOM has no contract to roll. It owns reserves and refineries, and its profits move
              with crude through operations rather than through the futures curve. In exchange it
              carries everything a company carries: capital discipline, refining margins,
              regulation, and the fact that it can underperform the barrel for its own reasons.
            </Body>
            <Body wide>
              Onchain there is one more wrinkle. Dividends on Robinhood Chain are not paid out as
              cash. They are folded into each token&apos;s multiplier, so the token quietly comes to
              represent slightly more stock over time. That is why an integration reading the raw
              quote feed alone understates what an XOM token is worth.
            </Body>
          </div>
        </div>
      </Section>
    </main>
  )
}
