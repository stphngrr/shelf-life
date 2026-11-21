// ABOUTME: Shared helpers for integration tests against the local Supabase stack.
// ABOUTME: Provides API clients, direct SQL access, test users, and a guarded database reset.

import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import pg from 'pg'

const LOCAL_DATABASE_HOSTS = ['127.0.0.1', 'localhost']
const TEST_USER_PASSWORD = 'integration-test-password'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env var ${name}; copy .env.example to .env.local and fill it in`)
  }
  return value
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } }

/** Client using the secret key: bypasses Row Level Security and can call admin APIs. */
export function secretClient(): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), clientOptions)
}

/** Client using the publishable key, as the browser app does. Starts with no session. */
export function publishableClient(): SupabaseClient {
  return createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('VITE_SUPABASE_PUBLISHABLE_KEY'), clientOptions)
}

/** Throws unless the URL points at a local database, so resets can never touch production. */
export function assertLocalDatabaseUrl(url: string): void {
  const host = new URL(url).hostname
  if (!LOCAL_DATABASE_HOSTS.includes(host)) {
    throw new Error(`Refusing to use non-local database host "${host}"`)
  }
}

/** Runs one SQL statement directly against the local database and returns its rows. */
export async function sql<Row extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<Row[]> {
  const url = requireEnv('SUPABASE_DB_URL')
  assertLocalDatabaseUrl(url)
  const client = new pg.Client({ connectionString: url })
  try {
    await client.connect()
  } catch (cause) {
    throw new Error(`Cannot reach the local database at ${url}; start it with \`npx supabase start\``, { cause })
  }
  try {
    const result = await client.query<Row>(text, params)
    return result.rows
  } finally {
    await client.end()
  }
}

/** Creates a confirmed user and returns it with a publishable-key client signed in as that user. */
export async function createTestUser(): Promise<{ user: User; client: SupabaseClient }> {
  const email = `test-${randomUUID()}@example.com`
  const created = await secretClient().auth.admin.createUser({
    email,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
  })
  if (created.error) throw created.error

  const client = publishableClient()
  const signedIn = await client.auth.signInWithPassword({ email, password: TEST_USER_PASSWORD })
  if (signedIn.error) throw signedIn.error

  return { user: created.data.user, client }
}

/** Empties every public table and deletes all auth users in the local database. */
export async function resetDatabase(): Promise<void> {
  const tables = await sql<{ name: string }>(
    "select format('%I.%I', schemaname, tablename) as name from pg_tables where schemaname = 'public'",
  )
  if (tables.length > 0) {
    await sql(`truncate ${tables.map((t) => t.name).join(', ')} restart identity cascade`)
  }
  await sql('delete from auth.users')
}
