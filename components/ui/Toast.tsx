'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { HAIRLINE } from './primitives'

export type ToastTone = 'info' | 'success' | 'error'

export type Toast = {
  id: number
  tone: ToastTone
  title: string
  body?: string
  href?: { label: string; url: string }
}

type ToastInput = Omit<Toast, 'id'> & { ttlMs?: number }

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

/** Async results need somewhere to land; this is that place. */
export function useToast() {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used inside <ToastProvider>')
  return push
}

const TONE = {
  info: { border: HAIRLINE, accent: 'rgba(255,255,255,0.62)' },
  success: { border: 'rgba(120,220,170,0.4)', accent: '#8FE6BE' },
  error: { border: 'rgba(252,168,224,0.4)', accent: '#FCA8E0' },
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    ({ ttlMs = 7000, ...input }: ToastInput) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-3), { ...input, id }])
      if (ttlMs > 0) setTimeout(() => dismiss(id), ttlMs)
    },
    [dismiss],
  )

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        // Announced politely: these report results, they do not demand action.
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-0 right-0 z-[60] flex flex-col items-end gap-2"
        style={{ padding: 'clamp(16px, 2vw, 28px)' }}
      >
        {toasts.map((toast) => {
          const tone = TONE[toast.tone]
          return (
            <div
              key={toast.id}
              className="pointer-events-auto"
              style={{
                width: 'min(360px, calc(100vw - 32px))',
                background: '#08080B',
                border: `1px solid ${tone.border}`,
                padding: '14px 16px',
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <p
                  className="font-mono uppercase"
                  style={{
                    fontSize: 10,
                    letterSpacing: '.14em',
                    color: tone.accent,
                    margin: 0,
                  }}
                >
                  {toast.title}
                </p>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss"
                  className="font-mono"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255,255,255,0.38)',
                    cursor: 'pointer',
                    fontSize: 11,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>

              {toast.body && (
                <p
                  style={{
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'rgba(255,255,255,0.62)',
                    marginTop: 8,
                    marginBottom: 0,
                  }}
                >
                  {toast.body}
                </p>
              )}

              {toast.href && (
                <a
                  href={toast.href.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono uppercase transition-colors hover:text-white"
                  style={{
                    display: 'inline-block',
                    marginTop: 10,
                    fontSize: 10,
                    letterSpacing: '.14em',
                    color: 'rgba(255,255,255,0.46)',
                  }}
                >
                  {toast.href.label} ↗
                </a>
              )}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
