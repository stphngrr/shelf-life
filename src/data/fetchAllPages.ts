// ABOUTME: Reads every row of a query from the Supabase API, which caps each response at 1,000 rows.
// ABOUTME: Requests consecutive pages until one comes back short.

import { unwrapResponse, type ApiResult } from './response.ts'

/** Matches the API's `max_rows` setting (supabase/config.toml). */
export const PAGE_SIZE = 1000

/**
 * `fetchPage` must return rows `from` through `to` (inclusive) of a query with a stable,
 * unique ordering, so consecutive pages neither skip nor repeat rows.
 */
export async function fetchAllPages<Row>(
  fetchPage: (from: number, to: number) => PromiseLike<ApiResult<Row[] | null>>,
): Promise<Row[]> {
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const page = unwrapResponse(await fetchPage(from, from + PAGE_SIZE - 1)) ?? []
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}
