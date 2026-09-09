'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseUnits } from 'viem'
import { useAccount, useSwitchChain } from 'wagmi'
import { explorerTx, robinhoodChain } from '@/lib/chain'
import { TOKENS, type TokenSymbol } from '@/lib/tokens'
import type { QuoteResponse, RotationQuote } from '@/lib/swap/types'
import { C } from '@/lib/hero.tokens'
import { HAIRLINE, Eyebrow, Panel } from '@/components/ui/primitives'
import { ConnectButton } from '@/components/wallet/ConnectButton'
import { formatUnitsFixed, useBalances } from '@/components/wallet/useBalances'
import { useRotation } from './useRotation'
import { TxStatus } from './TxStatus'
import { useToast } from '@/components/ui/Toast'
import {
  FAILURE_COPY,
  PRICE_IMPACT_SEVERE_BPS,
  PRICE_IMPACT_WARN_BPS,
  ROUTING_READY,
  isBusy,
} from '@/lib/swap/execution'

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0]
const MONO = 'clamp(9px, 0.73vw, 12px)'

type Direction = { from: TokenSymbol; to: TokenSymbol }

/** Only digits and a single decimal point — never trust an uncontrolled amount. */
function sanitizeAmount(input: string): string {
  const cleaned = input.replace(/[^\d.]/g, '')
  const parts = cleaned.split('.')
  if (parts.length <= 2) return cleaned
  return `${parts[0]}.${parts.slice(1).join('')}`
}

function TokenSide({
  label,
  symbol,
  children,
}: {
  label: string
  symbol: TokenSymbol
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <Eyebrow>{label}</Eyebrow>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-mono" style={{ fontSize: 17, color: '#fff', letterSpacing: '.05em' }}>
            {symbol}
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)' }}>
            {TOKENS[symbol].name}
          </span>
        </div>
      </div>
      {children}
    </div>
  )
}

export function RotateForm() {
  const [mounted, setMounted] = useState(false)
  const [direction, setDirection] = useState<Direction>({ from: 'XOM', to: 'USO' })
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState(0.5)
  const [quote, setQuote] = useState<RotationQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [pricing, setPricing] = useState(false)

  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const { balances, isLoading: balancesLoading } = useBalances()
  const { phase, start, reset } = useRotation()
  const toast = useToast()

  const busy = isBusy(phase)

  useEffect(() => setMounted(true), [])

  const wrongNetwork = isConnected && chainId !== robinhoodChain.id
  const fromToken = TOKENS[direction.from]
  const fromBalance = balances?.[direction.from]

  const amountWei = useMemo(() => {
    if (!amount || Number(amount) <= 0) return null
    try {
      return parseUnits(amount, fromToken.decimals)
    } catch {
      return null
    }
  }, [amount, fromToken.decimals])

  const insufficient = Boolean(fromBalance && amountWei && amountWei > fromBalance.raw)

  /* ----------------------------------------------------------------- */
  /* Quote                                                              */
  /* ----------------------------------------------------------------- */

  const requestId = useRef(0)

  useEffect(() => {
    // No amount means nothing to price. The stale quote is filtered out below
    // by derivation, so there is no state to clear here.
    if (!amountWei) return

    const id = ++requestId.current
    setPricing(true)

    // Debounced: the quote feed rate-limits, and every keystroke would hit it.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/quote', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ from: direction.from, to: direction.to, amount }),
        })
        const payload = (await response.json()) as QuoteResponse

        // A slower earlier request must never overwrite a newer answer.
        if (id !== requestId.current) return

        if (payload.ok) {
          setQuote(payload.quote)
          setQuoteError(null)
        } else {
          setQuote(null)
          setQuoteError(payload.error)
        }
      } catch {
        if (id !== requestId.current) return
        setQuote(null)
        setQuoteError('Could not reach the pricing endpoint.')
      } finally {
        if (id === requestId.current) setPricing(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [amount, amountWei, direction.from, direction.to])

  // A quote only counts while it still matches what is typed in the box.
  const visibleQuote =
    amountWei && quote && quote.amountIn === amount && quote.from === direction.from
      ? quote
      : null
  const visibleError = amountWei ? quoteError : null
  const isPricing = Boolean(amountWei) && (pricing || (!visibleQuote && !visibleError))

  const impactBps = visibleQuote?.priceImpactBps ?? null
  const impactTone =
    impactBps == null
      ? 'none'
      : impactBps >= PRICE_IMPACT_SEVERE_BPS
        ? 'severe'
        : impactBps >= PRICE_IMPACT_WARN_BPS
          ? 'warn'
          : 'ok'

  const minReceived = useMemo(() => {
    if (!visibleQuote) return null
    const out = Number(visibleQuote.amountOut)
    if (!Number.isFinite(out)) return null
    return (out * (1 - slippage / 100)).toFixed(6)
  }, [visibleQuote, slippage])

  const flip = useCallback(() => {
    setDirection((d) => ({ from: d.to, to: d.from }))
    setAmount('')
    setQuote(null)
    setQuoteError(null)
  }, [])

  const setMax = useCallback(() => {
    if (!fromBalance) return
    setAmount(formatUnitsFixed(fromBalance.raw, fromBalance.decimals, 6).replace(/,/g, ''))
  }, [fromBalance])

  /* ----------------------------------------------------------------- */
  /* Action state                                                       */
  /* ----------------------------------------------------------------- */

  const action = (() => {
    if (!mounted) return { kind: 'placeholder' as const }
    if (!isConnected) return { kind: 'connect' as const }
    if (wrongNetwork) return { kind: 'switch' as const }
    if (!amountWei) return { kind: 'disabled' as const, label: 'Enter an amount' }
    if (balancesLoading) return { kind: 'disabled' as const, label: 'Reading balances…' }
    if (insufficient) return { kind: 'disabled' as const, label: `Insufficient ${direction.from}` }
    if (isPricing) return { kind: 'disabled' as const, label: 'Pricing…' }
    if (visibleError) return { kind: 'disabled' as const, label: 'Cannot price this' }
    if (!visibleQuote) return { kind: 'disabled' as const, label: 'No quote' }
    if (busy) return { kind: 'disabled' as const, label: 'Rotation in progress' }
    if (!ROUTING_READY || visibleQuote.source === 'indicative') {
      return { kind: 'blocked' as const, label: 'Routing not connected' }
    }
    if (impactTone === 'severe') {
      return { kind: 'ready' as const, label: `Rotate anyway — ${(impactBps! / 100).toFixed(2)}% impact` }
    }
    return { kind: 'ready' as const, label: `Rotate into ${direction.to}` }
  })()

  const rotate = () => {
    if (!amountWei) return
    void start({
      from: direction.from,
      amount,
      onSettled: (settled) => {
        if (settled.kind === 'confirmed') {
          toast({
            tone: 'success',
            title: 'Rotation complete',
            body: `Moved into ${direction.to}.`,
            href: { label: 'View transaction', url: explorerTx(settled.hash) },
          })
        } else if (settled.kind === 'failed') {
          toast({ tone: 'error', title: FAILURE_COPY[settled.reason].title, body: FAILURE_COPY[settled.reason].body })
        }
      },
    })
  }

  return (
    <Panel>
      <div className="flex items-center justify-between gap-4">
        <Eyebrow>Rotate</Eyebrow>
        <span
          className="font-mono uppercase"
          style={{ fontSize: 10, letterSpacing: '.14em', color: 'rgba(255,255,255,0.38)' }}
        >
          One leg at a time
        </span>
      </div>

      {/* ---------------- From ---------------- */}
      <div className="mt-7" style={{ border: `1px solid ${HAIRLINE}`, padding: 18 }}>
        <TokenSide label="From" symbol={direction.from}>
          <button
            type="button"
            onClick={setMax}
            disabled={!fromBalance || fromBalance.raw === 0n}
            className="font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              fontSize: 10,
              letterSpacing: '.14em',
              border: `1px solid ${HAIRLINE}`,
              background: 'transparent',
              color: fromBalance?.raw ? '#fff' : 'rgba(255,255,255,0.3)',
              padding: '5px 9px',
              cursor: fromBalance?.raw ? 'pointer' : 'not-allowed',
            }}
          >
            Max
          </button>
        </TokenSide>

        <input
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
          disabled={busy}
          aria-label={`Amount of ${direction.from} to rotate`}
          className="font-mono w-full focus:outline-none"
          style={{
            marginTop: 18,
            background: 'transparent',
            border: 'none',
            color: insufficient ? C.particleHot : '#fff',
            fontSize: 'clamp(26px, 3vw, 38px)',
            fontVariantNumeric: 'tabular-nums',
            padding: 0,
          }}
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
            {mounted && isConnected
              ? fromBalance
                ? `Balance ${formatUnitsFixed(fromBalance.raw, fromBalance.decimals, 4)}`
                : balancesLoading
                  ? 'Balance …'
                  : 'Balance 0.0000'
              : 'Balance —'}
          </span>
          {insufficient && (
            <span className="font-mono" style={{ fontSize: 11, color: C.particleHot }}>
              Exceeds balance
            </span>
          )}
        </div>
      </div>

      {/* ---------------- Flip ---------------- */}
      <div className="flex justify-center" style={{ marginBlock: 10 }}>
        <button
          type="button"
          onClick={flip}
          disabled={busy}
          aria-label="Reverse direction"
          className="font-mono uppercase transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
          style={{
            fontSize: 10,
            letterSpacing: '.14em',
            border: `1px solid ${HAIRLINE}`,
            background: '#08080B',
            color: 'rgba(255,255,255,0.62)',
            padding: '7px 12px',
            cursor: 'pointer',
          }}
        >
          ↓ Reverse
        </button>
      </div>

      {/* ---------------- To ---------------- */}
      <div style={{ border: `1px solid ${HAIRLINE}`, padding: 18 }}>
        <TokenSide label="To" symbol={direction.to} />
        <div
          className="font-mono"
          style={{
            marginTop: 18,
            color: visibleQuote ? '#fff' : 'rgba(255,255,255,0.28)',
            fontSize: 'clamp(26px, 3vw, 38px)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {isPricing ? '…' : visibleQuote ? visibleQuote.amountOut : '0.00'}
        </div>
        <div className="mt-3 font-mono" style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
          {mounted && isConnected && balances?.[direction.to]
            ? `Balance ${formatUnitsFixed(balances[direction.to].raw, balances[direction.to].decimals, 4)}`
            : 'Balance —'}
        </div>
      </div>

      {/* ---------------- Slippage ---------------- */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>Slippage tolerance</Eyebrow>
        <div className="flex gap-2">
          {SLIPPAGE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setSlippage(preset)}
              className="font-mono focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
              style={{
                fontSize: 11,
                border: `1px solid ${slippage === preset ? 'rgba(63,71,255,0.6)' : HAIRLINE}`,
                background: slippage === preset ? 'rgba(63,71,255,0.14)' : 'transparent',
                color: slippage === preset ? '#fff' : 'rgba(255,255,255,0.55)',
                padding: '6px 11px',
                cursor: 'pointer',
              }}
            >
              {preset}%
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- Summary ---------------- */}
      <div className="mt-6" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
        {[
          { label: 'Rate', value: visibleQuote ? `1 ${direction.from} = ${visibleQuote.ratio} ${direction.to}` : '—' },
          { label: 'Spread cost', value: visibleQuote ? `${visibleQuote.spreadBps.toFixed(1)} bps` : '—' },
          {
            label: 'Price impact',
            value: impactBps != null ? `${impactBps.toFixed(1)} bps` : 'Not priced',
            tone: impactTone,
          },
          { label: `Min received (${slippage}%)`, value: minReceived ? `${minReceived} ${direction.to}` : '—' },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-6 py-3"
            style={{ borderBottom: `1px solid ${HAIRLINE}` }}
          >
            <span
              className="font-mono uppercase"
              style={{ fontSize: 10, letterSpacing: '.12em', color: 'rgba(255,255,255,0.42)' }}
            >
              {row.label}
            </span>
            <span
              className="font-mono"
              style={{
                fontSize: 12,
                color:
                  row.tone === 'severe' ? '#FCA8E0' : row.tone === 'warn' ? '#F5D9A0' : '#fff',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {row.value}
              {row.tone === 'severe' && ' ⚠'}
            </span>
          </div>
        ))}
      </div>

      {visibleError && (
        <p style={{ fontSize: 12, lineHeight: 1.55, color: C.particleHot, marginTop: 16 }}>
          {visibleError}
        </p>
      )}

      {/* ---------------- Action ---------------- */}
      <div className="mt-7">
        {action.kind === 'connect' ? (
          <ConnectButton compact />
        ) : action.kind === 'switch' ? (
          <button
            type="button"
            onClick={() => switchChain({ chainId: robinhoodChain.id })}
            disabled={isSwitching}
            className="font-mono uppercase w-full focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              fontSize: MONO,
              letterSpacing: '.14em',
              background: C.particleHot,
              color: '#1A0A14',
              padding: '13px 16px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {isSwitching ? 'Switching…' : 'Switch to Robinhood Chain'}
          </button>
        ) : action.kind === 'blocked' ? (
          <button
            type="button"
            onClick={rotate}
            className="font-mono uppercase w-full transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              fontSize: MONO,
              letterSpacing: '.14em',
              background: 'rgba(63,71,255,0.18)',
              color: '#8E93FF',
              padding: '13px 16px',
              border: '1px solid rgba(63,71,255,0.4)',
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        ) : action.kind === 'ready' ? (
          <button
            type="button"
            onClick={rotate}
            className="font-mono uppercase w-full transition-[filter] hover:brightness-110 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              fontSize: MONO,
              letterSpacing: '.14em',
              background: impactTone === 'severe' ? C.particleHot : C.accent,
              color: impactTone === 'severe' ? '#1A0A14' : '#fff',
              padding: '13px 16px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {action.label}
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="font-mono uppercase w-full"
            style={{
              fontSize: MONO,
              letterSpacing: '.14em',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.4)',
              padding: '13px 16px',
              border: `1px solid ${HAIRLINE}`,
              cursor: 'not-allowed',
            }}
          >
            {action.kind === 'placeholder' ? 'Connect' : action.label}
          </button>
        )}
      </div>

      <TxStatus phase={phase} onDismiss={reset} />

      {action.kind === 'blocked' && visibleQuote?.note && (
        <p
          style={{
            fontSize: 11,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.42)',
            marginTop: 14,
          }}
        >
          {visibleQuote.note} Everything above is live — the only missing piece is the aggregator call in{' '}
          <span className="font-mono" style={{ color: 'rgba(255,255,255,0.62)' }}>
            app/api/quote/route.ts
          </span>{' '}
          and the swap transaction it returns.
        </p>
      )}
    </Panel>
  )
}
