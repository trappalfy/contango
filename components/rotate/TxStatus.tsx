'use client'

import { explorerTx } from '@/lib/chain'
import { FAILURE_COPY, isAwaitingSignature, isInFlight, type TxPhase } from '@/lib/swap/execution'
import { HAIRLINE } from '@/components/ui/primitives'

const STEPS = ['Permit', 'Swap', 'Confirmed'] as const

/** Which of the three steps the current phase sits on. */
function stepIndex(phase: TxPhase): number {
  switch (phase.kind) {
    case 'permit':
    case 'approve':
      return 0
    case 'approve-pending':
    case 'swap':
    case 'pending':
      return 1
    case 'confirmed':
      return 2
    default:
      return -1
  }
}

function headline(phase: TxPhase): { title: string; body: string } {
  switch (phase.kind) {
    case 'permit':
      return {
        title: 'Sign the permit',
        body: 'Approve the spend in your wallet. This is a signature, not a transaction — it costs nothing and sends nothing.',
      }
    case 'approve':
      return {
        title: 'Approve the token',
        body: 'This token could not take a permit, so the allowance needs a transaction of its own. Confirm it in your wallet.',
      }
    case 'approve-pending':
      return { title: 'Approval in flight', body: 'Waiting for the allowance to land before the swap goes out.' }
    case 'swap':
      return {
        title: 'Confirm the rotation',
        body: 'Your wallet has the transaction. Check the amounts before you sign.',
      }
    case 'pending':
      return { title: 'Rotation in flight', body: 'Submitted to Robinhood Chain. Waiting for it to be mined.' }
    case 'confirmed':
      return {
        title: 'Rotation complete',
        body: phase.received
          ? `Received ${phase.received}. The tokens are in your wallet.`
          : 'The tokens are in your wallet.',
      }
    case 'failed':
      return FAILURE_COPY[phase.reason]
    default:
      return { title: '', body: '' }
  }
}

export function TxStatus({ phase, onDismiss }: { phase: TxPhase; onDismiss: () => void }) {
  if (phase.kind === 'idle') return null

  const failed = phase.kind === 'failed'
  const done = phase.kind === 'confirmed'
  const current = stepIndex(phase)
  const copy = headline(phase)
  const hash = 'hash' in phase ? phase.hash : undefined

  const accent = failed ? '#FCA8E0' : done ? '#8FE6BE' : '#8E93FF'

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        marginTop: 18,
        border: `1px solid ${failed ? 'rgba(252,168,224,0.4)' : done ? 'rgba(120,220,170,0.4)' : 'rgba(63,71,255,0.4)'}`,
        background: failed ? 'rgba(252,168,224,0.05)' : done ? 'rgba(120,220,170,0.05)' : 'rgba(63,71,255,0.06)',
        padding: 16,
      }}
    >
      {/* Step rail — hidden on failure, where the step is no longer the point. */}
      {!failed && (
        <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
          {STEPS.map((step, i) => {
            const state = i < current ? 'done' : i === current ? 'active' : 'todo'
            return (
              <div key={step} className="flex flex-1 items-center gap-2">
                <span
                  aria-hidden="true"
                  style={{
                    width: 6,
                    height: 6,
                    background:
                      state === 'todo' ? 'rgba(255,255,255,0.18)' : state === 'done' ? '#8FE6BE' : accent,
                  }}
                />
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: 9,
                    letterSpacing: '.14em',
                    color:
                      state === 'todo'
                        ? 'rgba(255,255,255,0.28)'
                        : state === 'done'
                          ? 'rgba(143,230,190,0.8)'
                          : '#fff',
                  }}
                >
                  {step}
                </span>
                {i < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    style={{ flex: 1, height: 1, background: HAIRLINE, minWidth: 8 }}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <p
          className="font-mono uppercase"
          style={{ fontSize: 10, letterSpacing: '.14em', color: accent, margin: 0 }}
        >
          {copy.title}
        </p>

        {(failed || done) && (
          <button
            type="button"
            onClick={onDismiss}
            className="font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              fontSize: 9,
              letterSpacing: '.14em',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.42)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            {failed ? 'Try again' : 'Done'}
          </button>
        )}
      </div>

      <p
        style={{
          fontSize: 12,
          lineHeight: 1.6,
          color: 'rgba(255,255,255,0.62)',
          marginTop: 10,
          marginBottom: 0,
        }}
      >
        {copy.body}
      </p>

      {phase.kind === 'failed' && phase.detail && (
        <p
          className="font-mono"
          style={{
            fontSize: 10,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.34)',
            marginTop: 10,
            wordBreak: 'break-word',
          }}
        >
          {phase.detail}
        </p>
      )}

      {(isAwaitingSignature(phase) || isInFlight(phase)) && (
        <p
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: '.14em', color: 'rgba(255,255,255,0.34)', marginTop: 12 }}
        >
          {isInFlight(phase) ? 'Waiting for the chain' : 'Waiting for your wallet'}
        </p>
      )}

      {hash && (
        <a
          href={explorerTx(hash)}
          target="_blank"
          rel="noreferrer"
          className="font-mono uppercase transition-colors hover:text-white"
          style={{
            display: 'inline-block',
            marginTop: 12,
            fontSize: 10,
            letterSpacing: '.14em',
            color: 'rgba(255,255,255,0.46)',
          }}
        >
          View on Blockscout ↗
        </a>
      )}
    </div>
  )
}
