// ABOUTME: Reads and writes the signed-in reader's book statuses in Supabase.
// ABOUTME: Row Level Security limits every query to the reader's own rows.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { StatusChange } from '../lib/statusTransitions.ts'
import type { StatusRecord } from '../types/catalog.ts'
import type { Database } from '../types/database.ts'
import { fetchAllPages } from './fetchAllPages.ts'

type Client = SupabaseClient<Database>

/** The reader's statuses keyed by book id; books with no entry are unmarked. */
export async function fetchStatuses(client: Client): Promise<Map<string, StatusRecord>> {
  const rows = await fetchAllPages((from, to) =>
    client.from('book_statuses').select('book_id, status, date_read, rating_quarters').order('book_id').range(from, to),
  )
  return new Map(
    rows.map((row) => [row.book_id, { status: row.status, dateRead: row.date_read, ratingQuarters: row.rating_quarters }]),
  )
}

export async function applyStatusChange(client: Client, userId: string, bookId: string, change: StatusChange): Promise<void> {
  if (change.kind === 'remove') {
    await client.from('book_statuses').delete().eq('user_id', userId).eq('book_id', bookId).throwOnError()
    return
  }
  const { status, dateRead, ratingQuarters } = change.record
  await client
    .from('book_statuses')
    .upsert({ user_id: userId, book_id: bookId, status, date_read: dateRead, rating_quarters: ratingQuarters })
    .throwOnError()
}
