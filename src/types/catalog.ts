// ABOUTME: Domain types for books in the catalog and the reader's status for each book.
// ABOUTME: Mirrors the database's book_status enum and the fields the browsing UI needs.

export const BOOK_STATUSES = ['want_to_read', 'read', 'dismissed'] as const

/** A reader's status for a book. A book with no status is unmarked. */
export type BookStatus = (typeof BOOK_STATUSES)[number]

export interface StatusRecord {
  status: BookStatus
  /** ISO date (YYYY-MM-DD); only set when the status is read. */
  dateRead: string | null
  /** Quarter stars, 0–20; only set when the status is read. */
  ratingQuarters: number | null
}

export interface StoryLink {
  source: string
  text: string
  url: string
}

/** Outside pages about a book; stored as the list entry's `external_links` JSON. */
export interface ExternalLinks {
  /** The book's page on the source list's own site. */
  listPage?: string
  goodreads?: string
  bookshop?: string
  appleBooks?: string
  worldcat?: string
  /** Articles, reviews, and interviews about the book. */
  stories: StoryLink[]
}

/** One book's appearance on a list, with the fields needed to browse and filter. */
export interface CatalogItem {
  entryId: string
  bookId: string
  title: string
  author: string
  year: number
  edition: string | null
  tags: string[]
  coverUrl: string | null
  removedFromSource: boolean
}
