// ABOUTME: Integration tests for importing catalog entries into the local database.
// ABOUTME: Uses the real NPR fixture, parsed and normalized exactly as the import CLI does.

import type { CatalogEntry } from '../../scripts/catalog/catalogEntry.ts'
import { fixtureEntries, NPR_LIST, runImport } from './catalogFixtures.ts'
import { createTestUser, resetDatabase, sql } from './supabase.ts'

async function count(table: string): Promise<number> {
  const rows = await sql<{ count: string }>(`select count(*) from public.${table}`)
  return Number(rows[0].count)
}

async function entryRow(sourceKey: string) {
  const rows = await sql(
    `select e.*, b.title, b.author, b.isbn10, b.isbn13, b.cover_url
     from public.list_entries e join public.books b on b.id = e.book_id
     where e.source_key = $1`,
    [sourceKey],
  )
  return rows[0]
}

function withChange(entries: CatalogEntry[], sourceKey: string, change: (e: CatalogEntry) => CatalogEntry) {
  return entries.map((e) => (e.sourceKey === sourceKey ? change(e) : e))
}

describe('importCatalogEntries', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('adds every entry and its book on the first import', async () => {
    const summary = await runImport(fixtureEntries)

    expect(summary).toEqual({ added: 26, updated: 0, unchanged: 0, removed: 0 })
    expect(await count('books')).toBe(26)
    expect(await count('list_entries')).toBe(26)
  })

  it('stores every normalized field', async () => {
    await runImport(fixtureEntries)
    const expected = fixtureEntries.find((e) => e.sourceKey === '2025:31')!

    const row = await entryRow('2025:31')

    expect(row).toMatchObject({
      title: expected.book.title,
      author: expected.book.author,
      isbn10: expected.book.isbn10,
      isbn13: expected.book.isbn13,
      cover_url: expected.book.coverUrl,
      year: expected.entry.year,
      edition: expected.entry.edition,
      tags: expected.entry.tags,
      blurb_html: expected.entry.blurbHtml,
      reviewers: expected.entry.reviewers,
      external_links: expected.entry.externalLinks,
      removed_from_source_at: null,
    })
    const [list] = await sql<{ id: string }>('select id from public.lists where slug = $1', [NPR_LIST])
    expect(row.list_id).toBe(list.id)
  })

  it('stores null editions and ISBNs as nulls', async () => {
    await runImport(fixtureEntries)

    expect(await entryRow('2024:172')).toMatchObject({ isbn10: null, isbn13: null })
    expect(await entryRow('2013:1')).toMatchObject({ edition: null })
  })

  it('changes nothing when the same entries are imported again', async () => {
    await runImport(fixtureEntries)
    const before = await sql('select id, book_id, updated_at from public.list_entries order by source_key')

    const summary = await runImport(fixtureEntries)

    expect(summary).toEqual({ added: 0, updated: 0, unchanged: 26, removed: 0 })
    expect(await sql('select id, book_id, updated_at from public.list_entries order by source_key')).toEqual(before)
    expect(await count('books')).toBe(26)
  })

  it('updates a changed entry and its book in place', async () => {
    await runImport(fixtureEntries)
    const before = await entryRow('2025:1')
    const changed = withChange(fixtureEntries, '2025:1', (e) => ({
      ...e,
      book: { ...e.book, title: 'A Corrected Title' },
      entry: { ...e.entry, tags: ['fiction'] },
    }))

    const summary = await runImport(changed)

    expect(summary).toEqual({ added: 0, updated: 1, unchanged: 25, removed: 0 })
    const after = await entryRow('2025:1')
    expect(after).toMatchObject({ id: before.id, book_id: before.book_id, title: 'A Corrected Title', tags: ['fiction'] })
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime())
  })

  it('counts a change to only the book as an update', async () => {
    await runImport(fixtureEntries)
    const changed = withChange(fixtureEntries, '2025:1', (e) => ({ ...e, book: { ...e.book, coverUrl: null } }))

    const summary = await runImport(changed)

    expect(summary.updated).toBe(1)
    expect(await entryRow('2025:1')).toMatchObject({ cover_url: null })
  })

  it('flags entries missing from the feed instead of deleting them', async () => {
    await runImport(fixtureEntries)

    const summary = await runImport(fixtureEntries.filter((e) => e.sourceKey !== '2025:1'))

    expect(summary).toEqual({ added: 0, updated: 0, unchanged: 25, removed: 1 })
    expect(await count('list_entries')).toBe(26)
    expect((await entryRow('2025:1')).removed_from_source_at).toEqual(expect.any(Date))
    const flagged = await sql('select source_key from public.list_entries where removed_from_source_at is not null')
    expect(flagged).toEqual([{ source_key: '2025:1' }])
  })

  it('does not re-flag an entry that is still missing', async () => {
    await runImport(fixtureEntries)
    const withoutOne = fixtureEntries.filter((e) => e.sourceKey !== '2025:1')
    await runImport(withoutOne)
    const firstFlag = (await entryRow('2025:1')).removed_from_source_at

    const summary = await runImport(withoutOne)

    expect(summary.removed).toBe(0)
    expect((await entryRow('2025:1')).removed_from_source_at).toEqual(firstFlag)
  })

  it('clears the flag when a missing entry returns', async () => {
    await runImport(fixtureEntries)
    await runImport(fixtureEntries.filter((e) => e.sourceKey !== '2025:1'))

    const summary = await runImport(fixtureEntries)

    expect(summary).toEqual({ added: 0, updated: 1, unchanged: 25, removed: 0 })
    expect((await entryRow('2025:1')).removed_from_source_at).toBeNull()
  })

  it('never touches reading statuses', async () => {
    await runImport(fixtureEntries)
    const { user } = await createTestUser()
    const { book_id: bookId } = await entryRow('2025:1')
    await sql(
      "insert into public.book_statuses (user_id, book_id, status, date_read, rating_quarters) values ($1, $2, 'read', '2025-06-14', 15)",
      [user.id, bookId],
    )
    const before = await sql('select * from public.book_statuses')

    await runImport(withChange(fixtureEntries, '2025:1', (e) => ({ ...e, book: { ...e.book, title: 'Changed' } })))
    await runImport(fixtureEntries.filter((e) => e.sourceKey !== '2025:1'))

    expect(await sql('select * from public.book_statuses')).toEqual(before)
  })

  it('only flags removals on the list being imported', async () => {
    await runImport(fixtureEntries)
    await sql("insert into public.lists (slug, name, source_url) values ('other-list', 'Other', 'https://example.com')")
    await runImport([fixtureEntries[0]], 'other-list')

    const summary = await runImport(fixtureEntries.slice(1))

    expect(summary.removed).toBe(1)
    const otherListFlags = await sql(
      `select e.removed_from_source_at from public.list_entries e
       join public.lists l on l.id = e.list_id where l.slug = 'other-list'`,
    )
    expect(otherListFlags).toEqual([{ removed_from_source_at: null }])
  })

  it('writes nothing when any entry fails to save', async () => {
    const broken = [...fixtureEntries, { ...fixtureEntries[0], sourceKey: '99999:1', entry: { ...fixtureEntries[0].entry, year: 99999 } }]

    await expect(runImport(broken)).rejects.toThrow('smallint')

    expect(await count('books')).toBe(0)
    expect(await count('list_entries')).toBe(0)
  })

  it('rolls back books already written when a later step fails', async () => {
    await sql(`
      create function public.fail_on_entry() returns trigger language plpgsql as $$
      begin
        if new.source_key = '2013:1' then raise exception 'simulated failure'; end if;
        return new;
      end $$`)
    await sql('create trigger fail_on_entry before insert on public.list_entries for each row execute function public.fail_on_entry()')
    try {
      await expect(runImport(fixtureEntries)).rejects.toThrow('simulated failure')

      expect(await count('books')).toBe(0)
      expect(await count('list_entries')).toBe(0)
    } finally {
      await sql('drop trigger fail_on_entry on public.list_entries')
      await sql('drop function public.fail_on_entry()')
    }
  })

  it('leaves the previous import intact when a later import fails', async () => {
    await runImport(fixtureEntries)
    const before = await sql('select * from public.list_entries order by source_key')
    const broken = withChange(fixtureEntries, '2025:1', (e) => ({ ...e, entry: { ...e.entry, year: 99999 } }))

    await expect(runImport(broken.filter((e) => e.sourceKey !== '2013:1'))).rejects.toThrow('smallint')

    expect(await sql('select * from public.list_entries order by source_key')).toEqual(before)
  })

  it('rejects an unknown list', async () => {
    await expect(runImport(fixtureEntries, 'no-such-list')).rejects.toThrow('Unknown list "no-such-list"')

    expect(await count('books')).toBe(0)
  })

  it('rejects entries that share a source key', async () => {
    await expect(runImport([fixtureEntries[0], fixtureEntries[0]])).rejects.toThrow('Duplicate source key "2025:1"')

    expect(await count('books')).toBe(0)
  })
})
