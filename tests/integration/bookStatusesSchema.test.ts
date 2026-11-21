// ABOUTME: Integration tests for the book_statuses table and book_status enum.
// ABOUTME: Verifies status values, rating range, read-only fields, keys, and cascades.

import { createTestUser, resetDatabase, secretClient, sql } from './supabase.ts'

async function insertBook() {
  const { data, error } = await secretClient()
    .from('books')
    .insert({ title: 'A Book', author: 'An Author' })
    .select()
    .single()
  if (error) throw error
  return data
}

async function setupUserAndBook() {
  const { user } = await createTestUser()
  const book = await insertBook()
  return { userId: user.id, bookId: book.id }
}

function insertStatus(row: Record<string, unknown>) {
  return secretClient().from('book_statuses').insert(row).select().single()
}

describe('book_statuses schema', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('stores a want_to_read status with no date or rating', async () => {
    const { userId, bookId } = await setupUserAndBook()

    const { data, error } = await insertStatus({ user_id: userId, book_id: bookId, status: 'want_to_read' })

    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'want_to_read', date_read: null, rating_quarters: null })
    expect(data.updated_at).toEqual(expect.any(String))
  })

  it('stores a dismissed status', async () => {
    const { userId, bookId } = await setupUserAndBook()

    const { error } = await insertStatus({ user_id: userId, book_id: bookId, status: 'dismissed' })

    expect(error).toBeNull()
  })

  it('stores a read status with a date read and a rating', async () => {
    const { userId, bookId } = await setupUserAndBook()

    const { data, error } = await insertStatus({
      user_id: userId,
      book_id: bookId,
      status: 'read',
      date_read: '2025-06-14',
      rating_quarters: 15,
    })

    expect(error).toBeNull()
    expect(data).toMatchObject({ status: 'read', date_read: '2025-06-14', rating_quarters: 15 })
  })

  it.each([0, 20, null])('accepts a read status with rating_quarters %s', async (rating) => {
    const { userId, bookId } = await setupUserAndBook()

    const { error } = await insertStatus({ user_id: userId, book_id: bookId, status: 'read', rating_quarters: rating })

    expect(error).toBeNull()
  })

  it.each([-1, 21])('rejects rating_quarters %s', async (rating) => {
    const { userId, bookId } = await setupUserAndBook()

    const { error } = await insertStatus({ user_id: userId, book_id: bookId, status: 'read', rating_quarters: rating })

    expect(error?.code).toBe('23514')
  })

  it.each(['want_to_read', 'dismissed'])('rejects a date read on a %s status', async (status) => {
    const { userId, bookId } = await setupUserAndBook()

    const { error } = await insertStatus({ user_id: userId, book_id: bookId, status, date_read: '2025-06-14' })

    expect(error?.code).toBe('23514')
  })

  it.each(['want_to_read', 'dismissed'])('rejects a rating on a %s status', async (status) => {
    const { userId, bookId } = await setupUserAndBook()

    const { error } = await insertStatus({ user_id: userId, book_id: bookId, status, rating_quarters: 12 })

    expect(error?.code).toBe('23514')
  })

  it('rejects an unknown status value', async () => {
    const { userId, bookId } = await setupUserAndBook()

    const { error } = await insertStatus({ user_id: userId, book_id: bookId, status: 'unmarked' })

    expect(error?.code).toBe('22P02')
  })

  it('allows only one status per user and book', async () => {
    const { userId, bookId } = await setupUserAndBook()
    await insertStatus({ user_id: userId, book_id: bookId, status: 'want_to_read' }).throwOnError()

    const { error } = await insertStatus({ user_id: userId, book_id: bookId, status: 'dismissed' })

    expect(error?.code).toBe('23505')
  })

  it('replaces the existing status on upsert', async () => {
    const { userId, bookId } = await setupUserAndBook()
    await insertStatus({ user_id: userId, book_id: bookId, status: 'want_to_read' }).throwOnError()

    await secretClient()
      .from('book_statuses')
      .upsert({ user_id: userId, book_id: bookId, status: 'read', rating_quarters: 18 })
      .throwOnError()

    const rows = await sql('select status, rating_quarters from public.book_statuses')
    expect(rows).toEqual([{ status: 'read', rating_quarters: 18 }])
  })

  it('rejects a status for a missing book', async () => {
    const { user } = await createTestUser()

    const { error } = await insertStatus({ user_id: user.id, book_id: crypto.randomUUID(), status: 'read' })

    expect(error?.code).toBe('23503')
  })

  it('deletes a user’s statuses when the user is deleted', async () => {
    const { userId, bookId } = await setupUserAndBook()
    await insertStatus({ user_id: userId, book_id: bookId, status: 'read' }).throwOnError()

    await secretClient().auth.admin.deleteUser(userId)

    const rows = await sql<{ count: string }>('select count(*) from public.book_statuses')
    expect(rows[0].count).toBe('0')
  })

  it('refuses to delete a book that has statuses', async () => {
    const { userId, bookId } = await setupUserAndBook()
    await insertStatus({ user_id: userId, book_id: bookId, status: 'read' }).throwOnError()

    const { error } = await secretClient().from('books').delete().eq('id', bookId)

    expect(error?.code).toBe('23503')
  })

  it('sets updated_at when a status changes', async () => {
    const { userId, bookId } = await setupUserAndBook()
    await insertStatus({ user_id: userId, book_id: bookId, status: 'want_to_read' }).throwOnError()
    await sql("update public.book_statuses set updated_at = now() - interval '1 day'")
    const [before] = await sql<{ updated_at: Date }>('select updated_at from public.book_statuses')

    await secretClient().from('book_statuses').update({ status: 'dismissed' }).eq('book_id', bookId).throwOnError()

    const [after] = await sql<{ updated_at: Date }>('select updated_at from public.book_statuses')
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime())
  })
})
