// ABOUTME: Loads catalog data into the local database for integration tests.
// ABOUTME: Uses the real NPR fixture, parsed and normalized exactly as the import CLI does.

import { readFileSync } from 'node:fs'
import pg from 'pg'
import type { CatalogEntry } from '../../scripts/catalog/catalogEntry.ts'
import { importCatalogEntries } from '../../scripts/catalog/importEntries.ts'
import { normalizeShelf } from '../../scripts/npr/normalize.ts'
import { parseShelf } from '../../scripts/npr/parseShelf.ts'

export const NPR_LIST = 'npr-books-we-love'

export const fixtureEntries: CatalogEntry[] = normalizeShelf(
  parseShelf(JSON.parse(readFileSync(new URL('../fixtures/npr-shelf-sample.json', import.meta.url), 'utf-8'))),
).entries

export function fixtureEntry(sourceKey: string): CatalogEntry {
  const entry = fixtureEntries.find((e) => e.sourceKey === sourceKey)
  if (!entry) throw new Error(`fixture has no entry ${sourceKey}`)
  return entry
}

/** Imports entries into the local database through the real catalog importer. */
export async function runImport(entries: CatalogEntry[], listSlug = NPR_LIST) {
  const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL })
  await client.connect()
  try {
    return await importCatalogEntries(client, listSlug, entries)
  } finally {
    await client.end()
  }
}
