// ABOUTME: Integration tests for the app's catalog queries against the local Supabase API.
// ABOUTME: Runs as a signed-in user, as the browser does, including catalogs larger than one API page.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogEntry } from '../../scripts/catalog/catalogEntry.ts'
import { fetchCatalog, fetchEntryDetail } from '../../src/data/catalog.ts'
import type { Database } from '../../src/types/database.ts'
import { fixtureEntries, fixtureEntry, runImport } from './catalogFixtures.ts'
import { createTestUser, publishableClient, resetDatabase, sql } from './supabase.ts'

function syntheticEntries(count: number): CatalogEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    sourceKey: `2000:${i}`,
    book: { title: `Book ${i}`, author: 'Author', isbn10: null, isbn13: null, coverUrl: null },
    entry: { year: 2000, edition: null, tags: [], blurbHtml: '', reviewers: [], externalLinks: { stories: [] } },
  }))
}

async function entryIds(sourceKey: string) {
  const rows = await sql<{ id: string; book_id: string }>('select id, book_id from public.list_entries where source_key = $1', [
    sourceKey,
  ])
  return { entryId: rows[0].id, bookId: rows[0].book_id }
}

describe('catalog data', () => {
  let client: SupabaseClient<Database>

  beforeEach(async () => {
    await resetDatabase()
    ;({ client } = await createTestUser())
  })

  describe('fetchCatalog', () => {
    it('returns every entry with the fields needed for browsing', async () => {
      await runImport(fixtureEntries)
      const source = fixtureEntry('2025:1')

      const catalog = await fetchCatalog(client)

      expect(catalog).toHaveLength(26)
      expect(catalog.find((item) => item.title === source.book.title)).toEqual({
        ...(await entryIds('2025:1')),
        title: 'A Book of Maps for You',
        author: 'Lourdes Heuer, illustrated by Maxwell Eaton III',
        year: 2025,
        edition: 'fall',
        tags: ['kids’ books'],
        coverUrl: 'https://apps.npr.org/best-books/assets/synced/covers/2025/082345570X.jpg',
        removedFromSource: false,
      })
    })

    it('marks entries that have left the source list', async () => {
      await runImport(fixtureEntries)
      await runImport(fixtureEntries.filter((e) => e.sourceKey !== '2025:1'))

      const catalog = await fetchCatalog(client)

      expect(catalog.filter((item) => item.removedFromSource).map((item) => item.title)).toEqual(['A Book of Maps for You'])
    })

    it('returns catalogs larger than one API page, without duplicates', async () => {
      await runImport(syntheticEntries(2000))

      const catalog = await fetchCatalog(client)

      expect(catalog).toHaveLength(2000)
      expect(new Set(catalog.map((item) => item.entryId)).size).toBe(2000)
    })

    it('returns nothing to a signed-out visitor', async () => {
      await runImport(fixtureEntries)

      expect(await fetchCatalog(publishableClient())).toEqual([])
    })
  })

  describe('fetchEntryDetail', () => {
    it('returns the blurb, reviewers, and links for one entry', async () => {
      await runImport(fixtureEntries)
      const source = fixtureEntry('2025:31')
      const { entryId } = await entryIds('2025:31')

      expect(await fetchEntryDetail(client, entryId)).toEqual({
        blurbHtml: source.entry.blurbHtml,
        reviewers: source.entry.reviewers,
        externalLinks: source.entry.externalLinks,
      })
    })

    it('rejects an entry that does not exist', async () => {
      const missingId = crypto.randomUUID()

      await expect(fetchEntryDetail(client, missingId)).rejects.toThrow(`List entry ${missingId} not found`)
    })
  })
})
