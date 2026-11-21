// ABOUTME: Creates the browser app's Supabase client.
// ABOUTME: Uses the PKCE auth flow so magic links return a ?code= query parameter, leaving the URL hash to the filters.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.ts'
import { PROJECT_PAUSED_STATUS } from './response.ts'

export type AppSupabaseClient = SupabaseClient<Database>

/**
 * A paused project answers every request with status 540 and a plain-text body. The auth client
 * can't parse that body and drops the status, so this gives it a JSON error body to report,
 * keeping the 540 status that both auth and data errors are classified by.
 */
async function fetchReportingPausedProject(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init)
  if (response.status !== PROJECT_PAUSED_STATUS) return response
  const message = 'The Supabase project is paused'
  return new Response(JSON.stringify({ code: 'project_paused', message, msg: message }), {
    status: PROJECT_PAUSED_STATUS,
    headers: { 'content-type': 'application/json' },
  })
}

interface AppClientOptions {
  /** Where the session is saved; distinct keys let several clients share one page, as tests do. */
  storageKey?: string
}

export function createAppSupabaseClient(
  url: string,
  publishableKey: string,
  { storageKey }: AppClientOptions = {},
): AppSupabaseClient {
  return createClient<Database>(url, publishableKey, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey },
    global: { fetch: fetchReportingPausedProject },
  })
}

interface SupabaseEnv {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

export function createAppSupabaseClientFromEnv(env: SupabaseEnv): AppSupabaseClient {
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = env
  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set; see .env.example')
  }
  return createAppSupabaseClient(url, key)
}
