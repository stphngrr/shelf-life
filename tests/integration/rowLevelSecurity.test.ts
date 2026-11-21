// ABOUTME: Integration tests for Row Level Security on all public tables.
// ABOUTME: Exercises the publishable-key API as anonymous and signed-in users, as the browser app does.

import type { SupabaseClient } from '@supabase/supabase-js'
import { createTestUser, publishableClient, resetDatabase, secretClient, sql } from './supabase.ts'

const CATALOG_TABLES = ['lists', 'books', 'list_entries'] as const

async function seedCatalog() {
  const admin = secretClient()
  const list = await admin
    .from('lists')
    .insert({ slug: 'test-list', name: 'Test List', source_url: 'https://example.com/list' })
    .select()
    .single()
    .throwOnError()
  const book = await admin
    .from('books')
    .insert({ title: 'A Book', author: 'An Author' })
    .select()
    .single()
    .throwOnError()
  const otherBook = await admin
    .from('books')
    .insert({ title: 'Another Book', author: 'Another Author' })
    .select()
    .single()
    .throwOnError()
  await admin
    .from('list_entries')
    .insert({ list_id: list.data.id, book_id: book.data.id, source_key: '2025:1', year: 2025 })
    .throwOnError()
  return { listId: list.data.id as string, bookId: book.data.id as string, otherBookId: otherBook.data.id as string }
}

async function countRows(table: string): Promise<number> {
  const rows = await sql<{ count: string }>(`select count(*) from public.${table}`)
  return Number(rows[0].count)
}

describe('row level security', () => {
  let bookId: string
  let otherBookId: string
  let alice: { id: string; client: SupabaseClient }
  let bob: { id: string; client: SupabaseClient }

  beforeEach(async () => {
    await resetDatabase()
    ;({ bookId, otherBookId } = await seedCatalog())
    const a = await createTestUser()
    const b = await createTestUser()
    alice = { id: a.user.id, client: a.client }
    bob = { id: b.user.id, client: b.client }
    await secretClient()
      .from('book_statuses')
      .insert({ user_id: bob.id, book_id: bookId, status: 'read', rating_quarters: 16 })
      .throwOnError()
  })

  describe('anonymous users', () => {
    it.each([...CATALOG_TABLES, 'book_statuses'])('read no rows from %s', async (table) => {
      const { data, error } = await publishableClient().from(table).select()

      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('cannot create a status', async () => {
      const { error } = await publishableClient()
        .from('book_statuses')
        .insert({ user_id: bob.id, book_id: otherBookId, status: 'read' })

      expect(error?.code).toBe('42501')
      expect(await countRows('book_statuses')).toBe(1)
    })
  })

  describe('signed-in users and the catalog', () => {
    it.each(CATALOG_TABLES)('can read %s', async (table) => {
      const { data, error } = await alice.client.from(table).select()

      expect(error).toBeNull()
      expect(data!.length).toBeGreaterThan(0)
    })

    it('cannot insert into the catalog', async () => {
      const { error } = await alice.client.from('books').insert({ title: 'Sneaky', author: 'Nobody' })

      expect(error?.code).toBe('42501')
      expect(await countRows('books')).toBe(2)
    })

    it('cannot update the catalog', async () => {
      await alice.client.from('books').update({ title: 'Changed' }).eq('id', bookId)

      const rows = await sql<{ title: string }>('select title from public.books where id = $1', [bookId])
      expect(rows[0].title).toBe('A Book')
    })

    it('cannot delete from the catalog', async () => {
      await alice.client.from('list_entries').delete().eq('source_key', '2025:1')

      expect(await countRows('list_entries')).toBe(1)
    })
  })

  describe('signed-in users and statuses', () => {
    it('can create, read, update, and delete their own status', async () => {
      await alice.client
        .from('book_statuses')
        .insert({ user_id: alice.id, book_id: bookId, status: 'want_to_read' })
        .throwOnError()

      await alice.client
        .from('book_statuses')
        .update({ status: 'read', rating_quarters: 15 })
        .eq('user_id', alice.id)
        .eq('book_id', bookId)
        .throwOnError()
      const afterUpdate = await alice.client.from('book_statuses').select('status, rating_quarters').throwOnError()
      expect(afterUpdate.data).toEqual([{ status: 'read', rating_quarters: 15 }])

      await alice.client.from('book_statuses').delete().eq('user_id', alice.id).eq('book_id', bookId).throwOnError()
      const afterDelete = await alice.client.from('book_statuses').select().throwOnError()
      expect(afterDelete.data).toEqual([])
    })

    it('cannot see another user’s statuses', async () => {
      const { data, error } = await alice.client.from('book_statuses').select()

      expect(error).toBeNull()
      expect(data).toEqual([])
    })

    it('cannot create a status for another user', async () => {
      const { error } = await alice.client
        .from('book_statuses')
        .insert({ user_id: bob.id, book_id: otherBookId, status: 'dismissed' })

      expect(error?.code).toBe('42501')
      expect(await countRows('book_statuses')).toBe(1)
    })

    it('cannot update another user’s status', async () => {
      await alice.client.from('book_statuses').update({ rating_quarters: 4 }).eq('user_id', bob.id)

      const rows = await sql<{ rating_quarters: number }>(
        'select rating_quarters from public.book_statuses where user_id = $1',
        [bob.id],
      )
      expect(rows[0].rating_quarters).toBe(16)
    })

    it('cannot delete another user’s status', async () => {
      await alice.client.from('book_statuses').delete().eq('user_id', bob.id)

      expect(await countRows('book_statuses')).toBe(1)
    })

    it('cannot reassign their own status to another user', async () => {
      await alice.client
        .from('book_statuses')
        .insert({ user_id: alice.id, book_id: otherBookId, status: 'want_to_read' })
        .throwOnError()

      const { error } = await alice.client
        .from('book_statuses')
        .update({ user_id: bob.id })
        .eq('user_id', alice.id)
        .eq('book_id', otherBookId)

      expect(error?.code).toBe('42501')
      const rows = await sql<{ user_id: string }>('select user_id from public.book_statuses where book_id = $1', [
        otherBookId,
      ])
      expect(rows).toEqual([{ user_id: alice.id }])
    })
  })
})
