// ABOUTME: Turns Supabase API results into data, or into errors the UI can explain.
// ABOUTME: A paused project (HTTP 540) or unreachable backend becomes a BackendUnavailableError.

import type { PostgrestError } from '@supabase/supabase-js'

/** Supabase's status for "The project the request was being made against has been paused." */
const PROJECT_PAUSED_STATUS = 540
/** supabase-js reports a failed network request as status 0; gateways report 502–504. */
const UNREACHABLE_STATUSES = [0, 502, 503, 504]

export type BackendUnavailableReason = 'paused' | 'unreachable'

export class BackendUnavailableError extends Error {
  readonly reason: BackendUnavailableReason

  constructor(reason: BackendUnavailableReason, status: number, cause: unknown) {
    super(
      reason === 'paused'
        ? 'The Supabase project is paused'
        : `The Supabase backend is unreachable (status ${status})`,
      { cause },
    )
    this.name = 'BackendUnavailableError'
    this.reason = reason
  }
}

/** The shape of a supabase-js query result; `T` already includes null where a query can return none. */
export interface ApiResult<T> {
  data: T
  error: PostgrestError | null
  status: number
}

export function unwrapResponse<T>({ data, error, status }: ApiResult<T>): T {
  if (!error) return data
  if (status === PROJECT_PAUSED_STATUS) throw new BackendUnavailableError('paused', status, error)
  if (UNREACHABLE_STATUSES.includes(status)) throw new BackendUnavailableError('unreachable', status, error)
  throw error
}
