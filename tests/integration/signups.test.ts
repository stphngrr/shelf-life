// ABOUTME: Integration tests confirming that nobody can create an account through the public API.
// ABOUTME: Accounts are created only by an administrator with the secret key.

import { publishableClient, resetDatabase, sql } from './supabase.ts'

async function countUsers(): Promise<number> {
  const rows = await sql<{ count: string }>('select count(*) from auth.users')
  return Number(rows[0].count)
}

describe('signups', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('rejects password signups', async () => {
    const { error } = await publishableClient().auth.signUp({
      email: 'stranger@example.com',
      password: 'a-strong-password',
    })

    expect(error?.code).toBe('signup_disabled')
    expect(await countUsers()).toBe(0)
  })

  it('does not create an account when an unknown email requests a magic link', async () => {
    const { error } = await publishableClient().auth.signInWithOtp({ email: 'stranger@example.com' })

    expect(error?.code).toBe('signup_disabled')
    expect(await countUsers()).toBe(0)
  })
})
