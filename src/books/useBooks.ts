// ABOUTME: Loads the catalog and the reader's statuses, and pairs each book with its status.
// ABOUTME: Cached by TanStack Query; statuses are keyed by reader so accounts never mix.

import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { fetchCatalog } from '../data/catalog.ts'
import { fetchStatuses } from '../data/statuses.ts'
import { useSupabase } from '../data/supabaseContext.ts'
import { describeRequestError } from '../lib/backendMessages.ts'
import type { CatalogItem, StatusRecord } from '../types/catalog.ts'

export type BrowseBook = CatalogItem & { status: StatusRecord | null }

export type BooksState =
  | { state: 'loading'; books: [] }
  | { state: 'failed'; books: []; message: string }
  | { state: 'ready'; books: BrowseBook[] }

export const catalogQueryKey = ['catalog'] as const

export function statusesQueryKey(userId: string) {
  return ['statuses', userId] as const
}

export function useBooks(userId: string): BooksState {
  const client = useSupabase()
  const catalog = useQuery({
    queryKey: catalogQueryKey,
    queryFn: () => fetchCatalog(client),
    // The catalog changes about once a year; reload it only when the page loads.
    staleTime: Infinity,
  })
  const statuses = useQuery({ queryKey: statusesQueryKey(userId), queryFn: () => fetchStatuses(client) })

  const error = catalog.error ?? statuses.error
  useEffect(() => {
    if (error) console.error('Could not load books', error)
  }, [error])

  const books = useMemo(
    () => catalog.data?.map((item) => ({ ...item, status: statuses.data?.get(item.bookId) ?? null })) ?? [],
    [catalog.data, statuses.data],
  )

  if (error) return { state: 'failed', books: [], message: describeRequestError(error, 'load your books') }
  if (!catalog.data || !statuses.data) return { state: 'loading', books: [] }
  return { state: 'ready', books }
}
