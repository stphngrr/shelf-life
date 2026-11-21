// ABOUTME: Root component for the shelf-life app.
// ABOUTME: Shows the sign-in screen until the reader is signed in, then the signed-in layout.

import { LoginScreen } from './auth/LoginScreen.tsx'
import { useSession } from './auth/useSession.ts'
import { useSupabase } from './data/supabaseContext.ts'

function App() {
  const client = useSupabase()
  const session = useSession()

  if (session.status === 'loading') {
    return <p className="p-4 text-gray-600">Loading…</p>
  }
  if (session.status === 'signedOut') {
    return <LoginScreen />
  }

  async function signOut() {
    const { error } = await client.auth.signOut()
    if (error) console.error('Sign out failed', error)
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-xl font-semibold tracking-tight">shelf-life</h1>
        <button type="button" onClick={signOut} className="text-sm text-gray-700 underline">
          Sign out
        </button>
      </header>
      <main className="p-4" />
    </div>
  )
}

export default App
