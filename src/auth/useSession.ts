// ABOUTME: Tracks whether the reader is signed in, following Supabase auth events.
// ABOUTME: Starts as loading while the client restores a saved session or exchanges a magic-link code.

import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { useSupabase } from '../data/supabaseContext.ts'

export type SessionState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; session: Session }

function toState(session: Session | null): SessionState {
  return session ? { status: 'signedIn', session } : { status: 'signedOut' }
}

export function useSession(): SessionState {
  const client = useSupabase()
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    let active = true
    client.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Could not restore the saved session', error)
      if (active) setState(toState(data.session))
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) setState(toState(session))
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  return state
}
