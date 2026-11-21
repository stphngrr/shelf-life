// ABOUTME: Turns a failed magic-link request into a message the reader can act on.
// ABOUTME: Recognizes unknown emails, rate limits, and a paused or unreachable backend.

import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'
import { PAUSED_MESSAGE, UNREACHABLE_MESSAGE } from '../lib/backendMessages.ts'
import { PROJECT_PAUSED_STATUS } from '../data/response.ts'

// With signups disabled, Supabase reports an unregistered email with one of these codes.
const NO_ACCOUNT_CODES = ['otp_disabled', 'signup_disabled', 'user_not_found']
const RATE_LIMIT_CODES = ['over_email_send_rate_limit', 'over_request_rate_limit']

export function describeSignInError(error: AuthError, email: string): string {
  if (error.status === PROJECT_PAUSED_STATUS) return PAUSED_MESSAGE
  if (isAuthRetryableFetchError(error)) return UNREACHABLE_MESSAGE
  if (error.code && NO_ACCOUNT_CODES.includes(error.code)) return `No account exists for ${email}.`
  if (error.code && RATE_LIMIT_CODES.includes(error.code)) {
    return 'Too many sign-in emails were requested. Wait a few minutes and try again.'
  }
  return `Could not send the sign-in link: ${error.message}`
}
