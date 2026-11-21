// ABOUTME: Decides which books match the browse filters: years, tags, status, and text search.
// ABOUTME: Years combine with OR, tags with AND; search spans all years but respects tags and status.

import type { BookStatus, CatalogItem, StatusRecord } from '../types/catalog.ts'

/** A status filter value: one of the stored statuses, or "unmarked" for books with no status. */
export type StatusFilter = BookStatus | 'unmarked'

export const STATUS_FILTERS: readonly StatusFilter[] = ['unmarked', 'want_to_read', 'read', 'dismissed']

export interface Filters {
  /** Selected years; empty means all years. */
  years: number[]
  /** Selected tags; a book must have every one. */
  tags: string[]
  /** Selected statuses; empty means all statuses. */
  statuses: StatusFilter[]
  search: string
}

export const DEFAULT_FILTERS: Filters = {
  years: [],
  tags: [],
  statuses: ['unmarked', 'want_to_read', 'read'],
  search: '',
}

export type FilterableBook = Pick<CatalogItem, 'title' | 'author' | 'year' | 'tags'> & {
  /** The reader's status for the book, or null when unmarked. */
  status: Pick<StatusRecord, 'status'> | null
}

/** Lowercases and strips accents so "Cañas" and "canas" compare equal. */
function foldForSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

function searchWords(search: string): string[] {
  return foldForSearch(search).split(/\s+/).filter((word) => word)
}

export function matchesFilters(book: FilterableBook, filters: Filters): boolean {
  const words = searchWords(filters.search)

  if (words.length > 0) {
    const haystack = foldForSearch(`${book.title} ${book.author}`)
    if (!words.every((word) => haystack.includes(word))) return false
  } else if (filters.years.length > 0 && !filters.years.includes(book.year)) {
    return false
  }

  if (!filters.tags.every((tag) => book.tags.includes(tag))) return false

  return isStatusIncluded(filters.statuses, book.status?.status ?? 'unmarked')
}

/** Whether books with this status are shown; an empty selection shows every status. */
export function isStatusIncluded(statuses: StatusFilter[], status: StatusFilter): boolean {
  return statuses.length === 0 || statuses.includes(status)
}

/**
 * Switches a status on or off in the selection, keeping the standard order. The last
 * selected status can't be switched off, since an empty selection would show nothing useful.
 */
export function toggleStatusFilter(statuses: StatusFilter[], status: StatusFilter): StatusFilter[] {
  const included = STATUS_FILTERS.filter((s) => isStatusIncluded(statuses, s))
  if (!included.includes(status)) return STATUS_FILTERS.filter((s) => included.includes(s) || s === status)
  return included.length === 1 ? included : included.filter((s) => s !== status)
}

export function filterBooks<T extends FilterableBook>(books: T[], filters: Filters): T[] {
  return books.filter((book) => matchesFilters(book, filters))
}
