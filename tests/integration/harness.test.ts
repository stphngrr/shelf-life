// ABOUTME: Integration tests for the shared Supabase test harness.
// ABOUTME: Runs against the real local Supabase stack started by `npx supabase start`.

import {
  assertLocalDatabaseUrl,
  createTestUser,
  publishableClient,
  resetDatabase,
  secretClient,
  sql,
} from './supabase.ts'

describe('assertLocalDatabaseUrl', () => {
  it('accepts 127.0.0.1 and localhost database URLs', () => {
    expect(() => assertLocalDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).not.toThrow()
    expect(() => assertLocalDatabaseUrl('postgresql://postgres:postgres@localhost:54322/postgres')).not.toThrow()
  })

  it('refuses a remote database URL', () => {
    expect(() =>
      assertLocalDatabaseUrl('postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres'),
    ).toThrow('Refusing to use non-local database host "db.abcdefgh.supabase.co"')
  })
})

describe('sql', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('explains how to start Supabase when the local database is unreachable', async () => {
    vi.stubEnv('SUPABASE_DB_URL', 'postgresql://postgres:postgres@127.0.0.1:1/postgres')

    await expect(sql('select 1')).rejects.toThrow(
      'Cannot reach the local database at postgresql://postgres:postgres@127.0.0.1:1/postgres; start it with `npx supabase start`',
    )
  })
})

describe('Supabase test harness', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('creates a test user with a signed-in client', async () => {
    const { user, client } = await createTestUser()

    const { data, error } = await client.auth.getUser()

    expect(error).toBeNull()
    expect(data.user?.id).toBe(user.id)
  })

  it('provides a publishable-key client with no session', async () => {
    const { data } = await publishableClient().auth.getSession()

    expect(data.session).toBeNull()
  })

  it('provides a secret-key client with admin access', async () => {
    await createTestUser()

    const { data, error } = await secretClient().auth.admin.listUsers()

    expect(error).toBeNull()
    expect(data.users).toHaveLength(1)
  })

  it('resetDatabase deletes all auth users', async () => {
    await createTestUser()
    await createTestUser()

    await resetDatabase()

    const rows = await sql<{ count: string }>('select count(*) from auth.users')
    expect(rows[0].count).toBe('0')
  })

  it('resetDatabase keeps the reference lists seeded by migrations', async () => {
    await resetDatabase()

    const rows = await sql<{ slug: string }>('select slug from public.lists')
    expect(rows).toEqual([{ slug: 'npr-books-we-love' }])
  })

  it('resetDatabase removes lists created by tests', async () => {
    await sql("insert into public.lists (slug, name, source_url) values ('test-list', 'Test', 'https://example.com')")

    await resetDatabase()

    const rows = await sql<{ slug: string }>('select slug from public.lists')
    expect(rows).toEqual([{ slug: 'npr-books-we-love' }])
  })

  it('resetDatabase empties public tables', async () => {
    await sql('create table public.harness_canary (id int)')
    try {
      await sql('insert into public.harness_canary values (1), (2)')

      await resetDatabase()

      const rows = await sql<{ count: string }>('select count(*) from public.harness_canary')
      expect(rows[0].count).toBe('0')
    } finally {
      await sql('drop table public.harness_canary')
    }
  })
})
