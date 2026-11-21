// ABOUTME: Reader-facing explanations for a Supabase backend that is paused or can't be reached.
// ABOUTME: Shared by sign-in and browsing so both say the same thing.

import { BackendUnavailableError } from '../data/response.ts'

export const PAUSED_MESSAGE = 'The Supabase project is paused. Restore it from the Supabase dashboard, then try again.'

export const UNREACHABLE_MESSAGE = "Can't reach the server. Check your connection and try again."

/** Explains a failed request, using the shared wording for a paused or unreachable backend. */
export function describeRequestError(error: unknown, action: string): string {
  if (error instanceof BackendUnavailableError) {
    return error.reason === 'paused' ? PAUSED_MESSAGE : UNREACHABLE_MESSAGE
  }
  return `Could not ${action}: ${error instanceof Error ? error.message : String(error)}`
}
