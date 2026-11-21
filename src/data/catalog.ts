// ABOUTME: Loads the book catalog from Supabase: the browsable list, and one entry's full details.
// ABOUTME: Row Level Security limits results to signed-in users.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogItem, ExternalLinks } from '../types/catalog.ts'
import type { Database } from '../types/database.ts'
import { fetchAllPages } from './fetchAllPages.ts'

type Client = SupabaseClient<Database>

export interface EntryDetail {
  blurbHtml: string | null
  reviewers: string[]
  externalLinks: ExternalLinks
}

// Blurbs, reviewers, and links are left out to keep the full-catalog load small.
const CATALOG_COLUMNS = 'id, year, edition, tags, removed_from_source_at, book:books!inner(id, title, author, cover_url)'

/** Every list entry with its book, in no particular order. */
export async function fetchCatalog(client: Client): Promise<CatalogItem[]> {
  const rows = await fetchAllPages((from, to) =>
    client.from('list_entries').select(CATALOG_COLUMNS).order('id').range(from, to),
  )
  return rows.map((row) => ({
    entryId: row.id,
    bookId: row.book.id,
    title: row.book.title,
    author: row.book.author,
    year: row.year,
    edition: row.edition,
    tags: row.tags,
    coverUrl: row.book.cover_url,
    removedFromSource: row.removed_from_source_at !== null,
  }))
}

export async function fetchEntryDetail(client: Client, entryId: string): Promise<EntryDetail> {
  const { data, error } = await client
    .from('list_entries')
    .select('blurb_html, reviewers, external_links')
    .eq('id', entryId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error(`List entry ${entryId} not found`)
  return {
    blurbHtml: data.blurb_html,
    reviewers: data.reviewers,
    // Written only by the catalog importer, which produces this shape.
    externalLinks: data.external_links as unknown as ExternalLinks,
  }
}
