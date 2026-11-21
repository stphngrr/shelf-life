// ABOUTME: Tests for the messages shown when a magic-link request fails.
// ABOUTME: Uses the real auth-js error classes the Supabase client returns.

import { AuthApiError, AuthRetryableFetchError, AuthUnknownError } from '@supabase/supabase-js'
import { describeSignInError } from './describeSignInError.ts'

const email = 'reader@example.com'

describe('describeSignInError', () => {
  it.each(['otp_disabled', 'signup_disabled', 'user_not_found'])('reports no account for %s', (code) => {
    expect(describeSignInError(new AuthApiError('Signups not allowed for otp', 422, code), email)).toBe(
      'No account exists for reader@example.com.',
    )
  })

  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])('asks the reader to wait for %s', (code) => {
    expect(describeSignInError(new AuthApiError('rate limited', 429, code), email)).toBe(
      'Too many sign-in emails were requested. Wait a few minutes and try again.',
    )
  })

  it('explains a paused project', () => {
    expect(describeSignInError(new AuthApiError('The Supabase project is paused', 540, 'project_paused'), email)).toBe(
      'The Supabase project is paused. Restore it from the Supabase dashboard, then try again.',
    )
  })

  it.each([
    ['a network failure', new AuthRetryableFetchError('fetch failed', 0)],
    ['a gateway error', new AuthRetryableFetchError('Bad Gateway', 502)],
  ])('explains an unreachable server after %s', (_label, error) => {
    expect(describeSignInError(error, email)).toBe("Can't reach the server. Check your connection and try again.")
  })

  it('passes along any other error message', () => {
    expect(describeSignInError(new AuthUnknownError('something odd', null), email)).toBe(
      'Could not send the sign-in link: something odd',
    )
  })
})
