// ABOUTME: Sign-in screen: the reader enters their email and receives a magic link.
// ABOUTME: Only existing accounts can sign in; signups are disabled.

import { useState, type FormEvent } from 'react'
import { useSupabase } from '../data/supabaseContext.ts'
import { describeSignInError } from './describeSignInError.ts'

type RequestState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'failed'; message: string }

export function LoginScreen() {
  const client = useSupabase()
  const [email, setEmail] = useState('')
  const [request, setRequest] = useState<RequestState>({ kind: 'idle' })

  async function sendLink(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    setRequest({ kind: 'sending' })
    const { error } = await client.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}` },
    })
    if (error) {
      console.error('Magic link request failed', error)
      setRequest({ kind: 'failed', message: describeSignInError(error, address) })
    } else {
      setRequest({ kind: 'sent', email: address })
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">shelf-life</h1>
      {request.kind === 'sent' ? (
        <p className="text-gray-700">
          We sent a sign-in link to {request.email}. Open it in this browser.
        </p>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-gray-900 focus:outline-none"
          />
          <button
            type="submit"
            disabled={request.kind === 'sending'}
            className="rounded-md bg-gray-900 px-3 py-2 font-medium text-white disabled:opacity-60"
          >
            {request.kind === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
          </button>
          {request.kind === 'failed' && (
            <p role="alert" className="text-sm text-red-700">
              {request.message}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
