// ABOUTME: React context that hands the Supabase client to components and hooks.
// ABOUTME: Lets tests supply a real client pointed at the local stack.

import { createContext, useContext } from 'react'
import type { AppSupabaseClient } from './supabaseClient.ts'

export const SupabaseContext = createContext<AppSupabaseClient | null>(null)

export function useSupabase(): AppSupabaseClient {
  const client = useContext(SupabaseContext)
  if (!client) throw new Error('useSupabase must be used inside a SupabaseProvider')
  return client
}
