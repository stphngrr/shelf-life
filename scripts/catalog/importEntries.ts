// ABOUTME: Imports a source list's catalog entries into Postgres in a single transaction.
// ABOUTME: Adds new books, updates changed ones, and flags entries that left the list; never deletes.

import type pg from 'pg'
import type { CatalogEntry } from './catalogEntry.ts'

export interface ImportSummary {
  added: number
  updated: number
  unchanged: number
  /** Entries newly flagged as missing from the source list. */
  removed: number
}

type Outcome = 'added' | 'updated' | 'unchanged'

// Staging table for the incoming rows, each classified against what is already stored.
const CREATE_STAGING_TABLE = `
  create temp table catalog_import_incoming (
    source_key text not null,
    title text not null,
    author text not null,
    isbn10 text,
    isbn13 text,
    cover_url text,
    year smallint not null,
    edition text,
    tags text[] not null,
    blurb_html text not null,
    reviewers text[] not null,
    external_links jsonb not null,
    entry_id uuid,
    book_id uuid,
    outcome text not null
  ) on commit drop`

const STAGE_AND_CLASSIFY = `
  insert into catalog_import_incoming
  select i.*, e.id, e.book_id,
    case
      when e.id is null then 'added'
      when e.removed_from_source_at is not null
        or (b.title, b.author, b.isbn10, b.isbn13, b.cover_url)
           is distinct from (i.title, i.author, i.isbn10, i.isbn13, i.cover_url)
        or (e.year, e.edition, e.tags, e.blurb_html, e.reviewers, e.external_links)
           is distinct from (i.year, i.edition, i.tags, i.blurb_html, i.reviewers, i.external_links)
        then 'updated'
      else 'unchanged'
    end
  from jsonb_to_recordset($2::jsonb) as i(
    source_key text, title text, author text, isbn10 text, isbn13 text, cover_url text,
    year smallint, edition text, tags text[], blurb_html text, reviewers text[], external_links jsonb
  )
  left join public.list_entries e on e.list_id = $1::uuid and e.source_key = i.source_key
  left join public.books b on b.id = e.book_id`

const INSERT_NEW_BOOKS = `
  update catalog_import_incoming set book_id = gen_random_uuid() where outcome = 'added';
  insert into public.books (id, title, author, isbn10, isbn13, cover_url)
    select book_id, title, author, isbn10, isbn13, cover_url
    from catalog_import_incoming where outcome = 'added'`

const INSERT_NEW_ENTRIES = `
  insert into public.list_entries
    (list_id, book_id, source_key, year, edition, tags, blurb_html, reviewers, external_links)
  select $1::uuid, book_id, source_key, year, edition, tags, blurb_html, reviewers, external_links
  from catalog_import_incoming where outcome = 'added'`

const UPDATE_CHANGED = `
  update public.books b
    set title = i.title, author = i.author, isbn10 = i.isbn10, isbn13 = i.isbn13, cover_url = i.cover_url
    from catalog_import_incoming i
    where i.outcome = 'updated' and b.id = i.book_id;
  update public.list_entries e
    set year = i.year, edition = i.edition, tags = i.tags, blurb_html = i.blurb_html,
        reviewers = i.reviewers, external_links = i.external_links, removed_from_source_at = null
    from catalog_import_incoming i
    where i.outcome = 'updated' and e.id = i.entry_id`

const FLAG_REMOVED = `
  update public.list_entries
    set removed_from_source_at = now()
    where list_id = $1::uuid
      and removed_from_source_at is null
      and source_key not in (select source_key from catalog_import_incoming)`

const COUNT_OUTCOMES = `select outcome, count(*)::int as count from catalog_import_incoming group by outcome`

function assertUniqueSourceKeys(entries: CatalogEntry[]): void {
  const seen = new Set<string>()
  for (const { sourceKey } of entries) {
    if (seen.has(sourceKey)) throw new Error(`Duplicate source key "${sourceKey}"`)
    seen.add(sourceKey)
  }
}

function toStagingRow(entry: CatalogEntry) {
  return {
    source_key: entry.sourceKey,
    title: entry.book.title,
    author: entry.book.author,
    isbn10: entry.book.isbn10,
    isbn13: entry.book.isbn13,
    cover_url: entry.book.coverUrl,
    year: entry.entry.year,
    edition: entry.entry.edition,
    tags: entry.entry.tags,
    blurb_html: entry.entry.blurbHtml,
    reviewers: entry.entry.reviewers,
    external_links: entry.entry.externalLinks,
  }
}

async function findListId(db: pg.ClientBase, listSlug: string): Promise<string> {
  const result = await db.query<{ id: string }>('select id from public.lists where slug = $1', [listSlug])
  if (result.rows.length === 0) throw new Error(`Unknown list "${listSlug}"`)
  return result.rows[0].id
}

/**
 * Makes the stored entries for `listSlug` match `entries`, all or nothing.
 * `db` must be a dedicated connection (not a pool) because the work runs in one transaction.
 */
export async function importCatalogEntries(
  db: pg.ClientBase,
  listSlug: string,
  entries: CatalogEntry[],
): Promise<ImportSummary> {
  assertUniqueSourceKeys(entries)

  await db.query('begin')
  try {
    const listId = await findListId(db, listSlug)
    await db.query(CREATE_STAGING_TABLE)
    await db.query(STAGE_AND_CLASSIFY, [listId, JSON.stringify(entries.map(toStagingRow))])
    await db.query(INSERT_NEW_BOOKS)
    await db.query(INSERT_NEW_ENTRIES, [listId])
    await db.query(UPDATE_CHANGED)
    const flagged = await db.query(FLAG_REMOVED, [listId])
    const outcomes = await db.query<{ outcome: Outcome; count: number }>(COUNT_OUTCOMES)
    await db.query('commit')

    const summary: ImportSummary = { added: 0, updated: 0, unchanged: 0, removed: flagged.rowCount ?? 0 }
    for (const { outcome, count } of outcomes.rows) summary[outcome] = count
    return summary
  } catch (error) {
    await db.query('rollback')
    throw error
  }
}
