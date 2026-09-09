'use client'

import { useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { TOKENS, TRACKED, type TokenSymbol } from '@/lib/tokens'
import { HAIRLINE, Eyebrow, Panel, Pill, Stat } from '@/components/ui/primitives'
import { ConnectButton } from './ConnectButton'
import { formatUnitsFixed, useBalances } from './useBalances'
import { PositionContext, RotationHistory } from './PositionContext'
import { explorerAddress, robinhoodChain } from '@/lib/chain'

/** Live per-token prices handed down from the server render. */
export type PriceMap = Partial<Record<TokenSymbol, string>>

const ONE = 10n ** 18n

/** Position value in USD, kept in fixed point until the very last step. */
function usdValue(raw: bigint, decimals: number, price: string | undefined): number | null {
  if (!price) return null
  const units = Number(formatUnits(raw, decimals))
  const p = Number(price)
  if (!Number.isFinite(units) || !Number.isFinite(p)) return null
  return units * p
}

const money = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function PortfolioPanel({ prices }: { prices: PriceMap }) {
  const { address, isConnected, chainId } = useAccount()
  const { balances, isLoading, isError } = useBalances()

  const wrongNetwork = isConnected && chainId !== robinhoodChain.id

  if (!isConnected) {
    return (
      <Panel>
        <Eyebrow>Not connected</Eyebrow>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', marginTop: 14 }}>
          Connect a wallet to read your balances. Contango takes no custody and cannot move
          anything — connecting is read-only until you sign a transaction.
        </p>
        <div className="mt-7">
          <ConnectButton compact />
        </div>
      </Panel>
    )
  }

  if (wrongNetwork) {
    return (
      <Panel>
        <Eyebrow>Wrong network</Eyebrow>
        <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', marginTop: 14 }}>
          Your wallet is on another chain. Switch to Robinhood Chain (4663) to read your position.
        </p>
        <div className="mt-7">
          <ConnectButton compact />
        </div>
      </Panel>
    )
  }

  const legTotal = (['XOM', 'USO'] as TokenSymbol[]).reduce((sum, symbol) => {
    const balance = balances?.[symbol]
    if (!balance) return sum
    const value = usdValue(balance.raw, balance.decimals, prices[symbol])
    return sum + (value ?? 0)
  }, 0)

  const heldLeg = (['XOM', 'USO'] as TokenSymbol[]).find(
    (symbol) => (balances?.[symbol]?.raw ?? 0n) > 0n,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Pill tone="live">Connected</Pill>
        {isError && <Pill tone="warn">Read failed</Pill>}
        <span className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.42)' }}>
          {address}
        </span>
      </div>

      <Panel accent>
        <div className="grid gap-8 sm:grid-cols-3">
          <Stat
            label="Pair exposure"
            value={isLoading ? '…' : `$${money(legTotal)}`}
            hint="XOM and USO combined"
            tone="accent"
          />
          <Stat
            label="Side held"
            value={isLoading ? '…' : (heldLeg ?? 'None')}
            hint={heldLeg ? 'Rotation moves this' : 'No position in the pair'}
          />
          <Stat
            label="Network"
            value="4663"
            hint="Robinhood Chain"
            tone="muted"
          />
        </div>
      </Panel>

      <Panel>
        <Eyebrow>Balances</Eyebrow>
        <div className="mt-5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          {TRACKED.map((symbol) => {
            const meta = TOKENS[symbol]
            const balance = balances?.[symbol]
            const value = balance ? usdValue(balance.raw, balance.decimals, prices[symbol]) : null
            const adjusted = balance?.multiplier != null && balance.multiplier !== ONE

            return (
              <div
                key={symbol}
                className="flex items-center justify-between gap-6 py-4"
                style={{ borderBottom: `1px solid ${HAIRLINE}` }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono" style={{ fontSize: 14, color: '#fff' }}>
                      {symbol}
                    </span>
                    {adjusted && (
                      <span
                        className="font-mono uppercase"
                        style={{ fontSize: 9, letterSpacing: '.12em', color: '#FCA8E0' }}
                        title="A split or dividend has moved this token's multiplier"
                      >
                        adjusted
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>{meta.name}</span>
                </div>

                <div className="text-right">
                  <div
                    className="font-mono"
                    style={{ fontSize: 14, color: '#fff', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {isLoading
                      ? '…'
                      : balance
                        ? formatUnitsFixed(balance.raw, balance.decimals, 4)
                        : '0.0000'}
                  </div>
                  <div className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
                    {value != null ? `$${money(value)}` : meta.kind === 'stable' ? '—' : 'no price'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p
          style={{
            fontSize: 11,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.38)',
            marginTop: 16,
          }}
        >
          Balances are raw ERC-20 amounts read straight from chain 4663. Stock tokens also carry an
          ERC-8056 multiplier, shown as “adjusted” once a split or dividend has moved it — the
          balance stays put while the shares behind each token change.
        </p>
      </Panel>

      <PositionContext heldLeg={(heldLeg as 'XOM' | 'USO' | undefined) ?? null} />

      <RotationHistory />

      <p className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
        <a
          href={explorerAddress(address ?? "")}
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-white"
          style={{ color: 'rgba(255,255,255,0.42)' }}
        >
          View on Blockscout ↗
        </a>
      </p>
    </div>
  )
}
