import type { Address, Hex } from 'viem'

/**
 * The transaction lifecycle for a rotation.
 *
 * The tokens implement EIP-2612 (verified on chain: DOMAIN_SEPARATOR() and
 * nonces() both answer), so the happy path is one off-chain signature followed
 * by one transaction. `approve` exists only as a fallback for a spender or
 * token that cannot take a permit — which is why the product can honestly keep
 * saying a rotation is a single transaction.
 */
export type TxPhase =
  | { kind: 'idle' }
  | { kind: 'permit' }
  | { kind: 'approve' }
  | { kind: 'approve-pending'; hash: Hex }
  | { kind: 'swap' }
  | { kind: 'pending'; hash: Hex }
  | { kind: 'confirmed'; hash: Hex; received: string | null }
  | { kind: 'failed'; reason: FailureReason; hash?: Hex; detail?: string }

export type FailureReason =
  | 'rejected'
  | 'slippage'
  | 'deadline'
  | 'reverted'
  | 'insufficient'
  | 'router-not-configured'
  | 'unknown'

export const FAILURE_COPY: Record<FailureReason, { title: string; body: string }> = {
  rejected: {
    title: 'Signature declined',
    body: 'You dismissed the request in your wallet. Nothing was sent and nothing moved.',
  },
  slippage: {
    title: 'Slippage exceeded',
    body: 'The price moved past your tolerance before the transaction landed, so it reverted rather than filling you worse. Raising the tolerance or retrying usually clears it.',
  },
  deadline: {
    title: 'Deadline expired',
    body: 'The quote aged out before the transaction was mined. Nothing was traded; request a fresh quote.',
  },
  reverted: {
    title: 'Transaction reverted',
    body: 'The swap was mined but rolled back. Your tokens are untouched; you still paid gas.',
  },
  insufficient: {
    title: 'Insufficient balance',
    body: 'The wallet no longer holds enough of the token to cover this rotation.',
  },
  'router-not-configured': {
    title: 'Routing not connected',
    body: 'This build has no aggregator credentials, so there is no route to execute against. Everything up to this point is live.',
  },
  unknown: {
    title: 'Something went wrong',
    body: 'The transaction could not be completed. No funds move unless a transaction succeeds.',
  },
}

/** Phases where the wallet is waiting on the person. */
export const isAwaitingSignature = (phase: TxPhase): boolean =>
  phase.kind === 'permit' || phase.kind === 'approve' || phase.kind === 'swap'

/** Phases where a transaction is in flight. */
export const isInFlight = (phase: TxPhase): boolean =>
  phase.kind === 'approve-pending' || phase.kind === 'pending'

/** Phases that block starting another rotation. */
export const isBusy = (phase: TxPhase): boolean =>
  isAwaitingSignature(phase) || isInFlight(phase)

/**
 * Maps a thrown wallet or RPC error onto a reason a person can act on.
 * Wallets are wildly inconsistent here, so this matches on message text as
 * well as on the error names viem gives us.
 */
export function classifyError(error: unknown): { reason: FailureReason; detail?: string } {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const lower = message.toLowerCase()

  if (
    lower.includes('user rejected') ||
    lower.includes('user denied') ||
    lower.includes('rejected the request') ||
    lower.includes('4001')
  ) {
    return { reason: 'rejected' }
  }
  if (lower.includes('slippage') || lower.includes('min return') || lower.includes('insufficient output')) {
    return { reason: 'slippage' }
  }
  if (lower.includes('deadline') || lower.includes('expired')) {
    return { reason: 'deadline' }
  }
  if (lower.includes('insufficient funds') || lower.includes('insufficient balance')) {
    return { reason: 'insufficient' }
  }
  if (lower.includes('reverted') || lower.includes('execution reverted')) {
    return { reason: 'reverted', detail: message.slice(0, 180) }
  }
  return { reason: 'unknown', detail: message ? message.slice(0, 180) : undefined }
}

/**
 * ---------------------------------------------------------------------------
 * THE REMAINING SEAM
 *
 * A rotation needs a spender to permit and calldata to send. Both come from
 * the aggregator, so both arrive with the routed quote from /api/quote.
 * Set NEXT_PUBLIC_ROUTER_ADDRESS once that is wired and the state machine
 * below runs end to end without further changes.
 * ---------------------------------------------------------------------------
 */
export const ROUTER_ADDRESS = (process.env.NEXT_PUBLIC_ROUTER_ADDRESS ?? '') as Address | ''

export const ROUTING_READY = ROUTER_ADDRESS.length === 42

/** Price impact above this is worth a warning rather than a number. */
export const PRICE_IMPACT_WARN_BPS = 100
export const PRICE_IMPACT_SEVERE_BPS = 300
