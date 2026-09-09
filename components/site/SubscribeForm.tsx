'use client'

import { useId, useState } from 'react'

/**
 * The subscribe form — §5 and §11 of the footer brief.
 *
 * Real inputs with real labels, hidden visually but not from a screen reader,
 * because §11 is explicit that a placeholder is not a label.
 *
 * The brief also specifies a `+` button beside SUBSCRIBE that opens further
 * fields, and says in the same breath to drop it when there is nothing to
 * open. There is nothing to open here, so it is not drawn.
 */

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; already: boolean }
  | { kind: 'error'; message: string }

const FIELD_HEIGHT = 40
const GAP = 7

export function SubscribeForm({ title }: { title: string }) {
  const nameId = useId()
  const emailId = useId()
  const [state, setState] = useState<State>({ kind: 'idle' })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  const sending = state.kind === 'sending'

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (sending) return

    setState({ kind: 'sending' })
    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, name: name || undefined }),
      })
      const data = await response.json()

      if (!response.ok || !data?.ok) {
        setState({ kind: 'error', message: data?.error ?? 'Could not record that.' })
        return
      }

      setState({ kind: 'done', already: data.status === 'already' })
      setName('')
      setEmail('')
    } catch {
      setState({ kind: 'error', message: 'No connection. Try again shortly.' })
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: '#fff',
          margin: 0,
          marginBottom: 11,
          lineHeight: 1.3,
          // The one heading on the site that is not the display serif: at 15px
          // it is an interface label, and §11.2 keeps the serif above 20px.
          fontFamily: 'var(--font-sans-ui), system-ui, sans-serif',
        }}
      >
        {title}
      </h2>

      <label htmlFor={nameId} className="sr-only">
        Your name
      </label>
      <input
        id={nameId}
        className="footer-field"
        type="text"
        name="name"
        autoComplete="name"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ height: FIELD_HEIGHT, marginBottom: GAP }}
      />

      <label htmlFor={emailId} className="sr-only">
        Your email address
      </label>
      <input
        id={emailId}
        className="footer-field"
        type="email"
        name="email"
        autoComplete="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ height: FIELD_HEIGHT, marginBottom: GAP }}
      />

      <button type="submit" className="footer-submit" disabled={sending} style={{ height: 41 }}>
        {sending ? 'Sending' : 'Subscribe'}
      </button>

      <p
        role="status"
        aria-live="polite"
        style={{
          fontSize: 11,
          lineHeight: 1.5,
          marginTop: 12,
          marginBottom: 0,
          minHeight: 17,
          color:
            state.kind === 'error'
              ? '#FCA8E0'
              : state.kind === 'done'
                ? 'rgba(255,255,255,0.62)'
                : 'var(--color-fg-faint)',
        }}
      >
        {state.kind === 'error'
          ? state.message
          : state.kind === 'done'
            ? state.already
              ? 'Already on the list.'
              : 'On the list.'
            : 'Unsubscribe anytime.'}
      </p>
    </form>
  )
}
