// ABOUTME: Describes a list entry, and the book it refers to, in the shape the catalog import writes.
// ABOUTME: Source-specific normalizers (such as NPR's) produce these; the importer consumes them.

import type { ExternalLinks } from '../../src/types/catalog.ts'

export type { ExternalLinks, StoryLink } from '../../src/types/catalog.ts'

export interface CatalogBook {
  title: string
  author: string
  isbn10: string | null
  isbn13: string | null
  coverUrl: string | null
}

export interface CatalogListEntry {
  year: number
  edition: string | null
  tags: string[]
  blurbHtml: string
  reviewers: string[]
  externalLinks: ExternalLinks
}

export interface CatalogEntry {
  /** The source list's natural key for this entry, unique within the list. */
  sourceKey: string
  book: CatalogBook
  entry: CatalogListEntry
}
