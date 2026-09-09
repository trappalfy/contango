'use client'

import { useEffect, useState } from 'react'
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { robinhoodChain } from '@/lib/chain'
import { shortAddress } from '@/lib/tokens'
import { C } from '@/lib/hero.tokens'
import { HAIRLINE } from '@/components/ui/primitives'

const MONO = 'clamp(9px, 0.73vw, 12px)'

const buttonBase = {
  fontSize: MONO,
  letterSpacing: '.14em',
  padding: '7px 14px',
  borderRadius: 0,
  outlineOffset: '3px',
  cursor: 'pointer',
  border: 'none',
} as const

/**
 * Connection state for the navbar and for any page that needs it.
 *
 * Nothing wallet-dependent renders until after mount: wagmi is configured with
 * ssr: true so the server never sees a connected account, and rendering one on
 * the client during hydration would mismatch.
 */
export function ConnectButton({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  const { address, isConnected, chainId } = useAccount()
  const { connectors, connect, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  useEffect(() => setMounted(true), [])

  // The picker is derived, not synchronised: a live connection closes it by
  // definition, so there is no state to reset when one lands.
  const pickerOpen = open && !isConnected

  if (!mounted) {
    return (
      <span
        className="font-mono uppercase"
        style={{ ...buttonBase, background: C.navBtnBg, color: C.navBtnText, display: 'inline-block' }}
      >
        Connect
      </span>
    )
  }

  if (isConnected && chainId !== robinhoodChain.id) {
    return (
      <button
        type="button"
        onClick={() => switchChain({ chainId: robinhoodChain.id })}
        disabled={isSwitching}
        className="font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
        style={{ ...buttonBase, background: C.particleHot, color: '#1A0A14' }}
      >
        {isSwitching ? 'Switching…' : 'Wrong network'}
      </button>
    )
  }

  if (isConnected && address) {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="font-mono uppercase"
          style={{
            fontSize: MONO,
            letterSpacing: '.1em',
            color: '#fff',
            border: `1px solid ${HAIRLINE}`,
            padding: '6px 10px',
          }}
        >
          {shortAddress(address)}
        </span>
        {!compact && (
          <button
            type="button"
            onClick={() => disconnect()}
            className="font-mono uppercase focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
            style={{
              ...buttonBase,
              background: 'transparent',
              color: 'rgba(255,255,255,0.46)',
              padding: '6px 6px',
            }}
          >
            Exit
          </button>
        )}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-mono uppercase transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
        style={{ ...buttonBase, background: C.navBtnBg, color: C.navBtnText }}
      >
        Connect
      </button>

      {pickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Connect a wallet"
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(3,3,5,0.82)', padding: 24 }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              background: '#08080B',
              border: `1px solid ${HAIRLINE}`,
              padding: 'clamp(20px, 3vw, 32px)',
            }}
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <p
                  className="font-mono uppercase"
                  style={{ fontSize: 10, letterSpacing: '.14em', color: 'rgba(255,255,255,0.46)', margin: 0 }}
                >
                  Connect
                </p>
                <p style={{ fontSize: 18, fontWeight: 400, color: '#fff', marginTop: 10, marginBottom: 0 }}>
                  Robinhood Chain
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="font-mono uppercase"
                style={{ ...buttonBase, background: 'transparent', color: 'rgba(255,255,255,0.46)', padding: 0 }}
              >
                Close
              </button>
            </div>

            <div className="mt-7 flex flex-col gap-2">
              {connectors.length === 0 && (
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)' }}>
                  No browser wallet found. Install one that can add a custom network, then reload
                  this page.
                </p>
              )}

              {connectors.map((connector) => (
                <button
                  key={connector.uid}
                  type="button"
                  onClick={() => connect({ connector, chainId: robinhoodChain.id })}
                  disabled={isPending}
                  className="flex w-full items-center justify-between transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-white"
                  style={{
                    border: `1px solid ${HAIRLINE}`,
                    background: 'rgba(255,255,255,0.015)',
                    padding: '14px 16px',
                    cursor: isPending ? 'wait' : 'pointer',
                    color: '#fff',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{connector.name}</span>
                  <span
                    className="font-mono uppercase"
                    style={{ fontSize: 10, letterSpacing: '.14em', color: 'rgba(255,255,255,0.38)' }}
                  >
                    {isPending ? 'Waiting' : 'Connect'}
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <p style={{ fontSize: 12, lineHeight: 1.55, color: C.particleHot, marginTop: 16 }}>
                {error.message}
              </p>
            )}

            <p
              style={{
                fontSize: 11,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.38)',
                marginTop: 20,
              }}
            >
              Contango never takes custody. Connecting only lets the page read balances you already
              hold; nothing can move without a transaction you sign.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
