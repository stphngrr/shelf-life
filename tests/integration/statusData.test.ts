// ABOUTME: Integration tests for reading and writing the signed-in reader's book statuses.
// ABOUTME: Runs against the local Supabase API with Row Level Security in force.

import type { SupabaseClient, User } from '@supabase/supabase-js'
import { applyStatusChange, fetchStatuses } from '../../src/data/statuses.ts'
import type { Database } from '../../src/types/database.ts'
import { runImport, syntheticEntries } from './catalogFixtures.ts'
import { createTestUser, resetDatabase, sql } from './supabase.ts'

async function bookIds(): Promise<string[]> {
  const rows = await sql<{ id: string }>('select id from public.books order by id')
  return rows.map((row) => row.id)
}

describe('status data', () => {
  let user: User
  let client: SupabaseClient<Database>
  let bookId: string
  let otherBookId: string

  beforeEach(async () => {
    await resetDatabase()
    await runImport(syntheticEntries(2))
    ;[bookId, otherBookId] = await bookIds()
    ;({ user, client } = await createTestUser())
  })

  it('returns no statuses for a reader who has marked nothing', async () => {
    expect(await fetchStatuses(client)).toEqual(new Map())
  })

  it('saves a status and reads it back by book', async () => {
    await applyStatusChange(client, user.id, bookId, {
      kind: 'save',
      record: { status: 'want_to_read', dateRead: null, ratingQuarters: null },
    })

    expect(await fetchStatuses(client)).toEqual(
      new Map([[bookId, { status: 'want_to_read', dateRead: null, ratingQuarters: null }]]),
    )
  })

  it('replaces an existing status', async () => {
    await applyStatusChange(client, user.id, bookId, {
      kind: 'save',
      record: { status: 'want_to_read', dateRead: null, ratingQuarters: null },
    })

    await applyStatusChange(client, user.id, bookId, {
      kind: 'save',
      record: { status: 'read', dateRead: '2025-06-14', ratingQuarters: 15 },
    })

    expect((await fetchStatuses(client)).get(bookId)).toEqual({ status: 'read', dateRead: '2025-06-14', ratingQuarters: 15 })
  })

  it('removes a status, leaving the book unmarked', async () => {
    await applyStatusChange(client, user.id, bookId, {
      kind: 'save',
      record: { status: 'dismissed', dateRead: null, ratingQuarters: null },
    })

    await applyStatusChange(client, user.id, bookId, { kind: 'remove' })

    expect(await fetchStatuses(client)).toEqual(new Map())
  })

  it('treats removing an unmarked book as already done', async () => {
    await expect(applyStatusChange(client, user.id, bookId, { kind: 'remove' })).resolves.toBeUndefined()
  })

  it('returns only the signed-in reader’s statuses', async () => {
    const other = await createTestUser()
    await applyStatusChange(other.client, other.user.id, otherBookId, {
      kind: 'save',
      record: { status: 'read', dateRead: null, ratingQuarters: null },
    })

    expect(await fetchStatuses(client)).toEqual(new Map())
  })

  it('refuses to save a status for another reader', async () => {
    const other = await createTestUser()

    await expect(
      applyStatusChange(client, other.user.id, bookId, {
        kind: 'save',
        record: { status: 'read', dateRead: null, ratingQuarters: null },
      }),
    ).rejects.toThrow('row-level security')
  })

  it('rejects a status the database does not allow, saving nothing', async () => {
    await expect(
      applyStatusChange(client, user.id, bookId, {
        kind: 'save',
        record: { status: 'want_to_read', dateRead: '2025-06-14', ratingQuarters: null },
      }),
    ).rejects.toThrow('read_details_only_when_read')

    expect(await fetchStatuses(client)).toEqual(new Map())
  })

  it('returns more statuses than fit in one API page', async () => {
    await resetDatabase()
    await runImport(syntheticEntries(1500))
    ;({ user, client } = await createTestUser())
    await sql("insert into public.book_statuses (user_id, book_id, status) select $1, id, 'dismissed' from public.books", [
      user.id,
    ])

    expect((await fetchStatuses(client)).size).toBe(1500)
  })
})
