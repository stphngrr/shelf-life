// ABOUTME: Reads every row of a query from the Supabase API, which caps each response at 1,000 rows.
// ABOUTME: Requests consecutive pages until one comes back short.

import type { PostgrestError } from '@supabase/supabase-js'

/** Matches the API's `max_rows` setting (supabase/config.toml). */
export const PAGE_SIZE = 1000

interface PageResult<Row> {
  data: Row[] | null
  error: PostgrestError | null
}

/**
 * `fetchPage` must return rows `from` through `to` (inclusive) of a query with a stable,
 * unique ordering, so consecutive pages neither skip nor repeat rows.
 */
export async function fetchAllPages<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<Row>>,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGE_SIZE) return rows
  }
}
