// ABOUTME: Provides the Supabase client to the component tree.
// ABOUTME: Pair with useSupabase() to read it.

import type { ReactNode } from 'react'
import type { AppSupabaseClient } from './supabaseClient.ts'
import { SupabaseContext } from './supabaseContext.ts'

export function SupabaseProvider({ client, children }: { client: AppSupabaseClient; children: ReactNode }) {
  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>
}
