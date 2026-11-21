// ABOUTME: Integration tests for the catalog tables: lists, books, and list_entries.
// ABOUTME: Verifies defaults, keys, and relational constraints in the local database.

import { resetDatabase, secretClient, sql } from './supabase.ts'

async function insertList(slug = 'test-list') {
  const { data, error } = await secretClient()
    .from('lists')
    .insert({ slug, name: 'Test List', source_url: 'https://example.com/list' })
    .select()
    .single()
  if (error) throw error
  return data
}

async function insertBook(title = 'A Book') {
  const { data, error } = await secretClient()
    .from('books')
    .insert({ title, author: 'An Author' })
    .select()
    .single()
  if (error) throw error
  return data
}

describe('catalog schema', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('seeds the NPR Books We Love list', async () => {
    const { data, error } = await secretClient().from('lists').select('slug, name, source_url')

    expect(error).toBeNull()
    expect(data).toEqual([
      { slug: 'npr-books-we-love', name: 'NPR Books We Love', source_url: 'https://apps.npr.org/best-books/' },
    ])
  })

  it('stores a list entry joined to its list and book, with defaults filled in', async () => {
    const list = await insertList()
    const book = await insertBook()

    const { data, error } = await secretClient()
      .from('list_entries')
      .insert({ list_id: list.id, book_id: book.id, source_key: '2025:1', year: 2025 })
      .select('*, lists(slug), books(title)')
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({
      source_key: '2025:1',
      year: 2025,
      edition: null,
      tags: [],
      reviewers: [],
      blurb_html: null,
      external_links: {},
      removed_from_source_at: null,
      lists: { slug: 'test-list' },
      books: { title: 'A Book' },
    })
    expect(data.id).toEqual(expect.any(String))
    expect(data.imported_at).toEqual(expect.any(String))
    expect(data.updated_at).toEqual(expect.any(String))
  })

  it('stores optional book fields', async () => {
    const { data, error } = await secretClient()
      .from('books')
      .insert({
        title: 'A Book of Maps for You',
        author: 'Lourdes Heuer',
        isbn10: '082345570X',
        isbn13: '9780823455706',
        cover_url: 'https://example.com/cover.jpg',
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({ isbn10: '082345570X', isbn13: '9780823455706', cover_url: 'https://example.com/cover.jpg' })
  })

  it('rejects a duplicate source_key within the same list', async () => {
    const list = await insertList()
    const book = await insertBook()
    const entry = { list_id: list.id, book_id: book.id, source_key: '2025:1', year: 2025 }
    await secretClient().from('list_entries').insert(entry).throwOnError()

    const { error } = await secretClient().from('list_entries').insert(entry)

    expect(error?.code).toBe('23505')
  })

  it('allows the same source_key on different lists', async () => {
    const first = await insertList('first-list')
    const second = await insertList('second-list')
    const book = await insertBook()
    await secretClient()
      .from('list_entries')
      .insert({ list_id: first.id, book_id: book.id, source_key: '2025:1', year: 2025 })
      .throwOnError()

    const { error } = await secretClient()
      .from('list_entries')
      .insert({ list_id: second.id, book_id: book.id, source_key: '2025:1', year: 2025 })

    expect(error).toBeNull()
  })

  it('rejects a duplicate list slug', async () => {
    await insertList('same-slug')

    const { error } = await secretClient()
      .from('lists')
      .insert({ slug: 'same-slug', name: 'Other', source_url: 'https://example.com/other' })

    expect(error?.code).toBe('23505')
  })

  it('rejects an entry that references a missing book', async () => {
    const list = await insertList()

    const { error } = await secretClient()
      .from('list_entries')
      .insert({ list_id: list.id, book_id: crypto.randomUUID(), source_key: '2025:1', year: 2025 })

    expect(error?.code).toBe('23503')
  })

  it('refuses to delete a book that still has list entries', async () => {
    const list = await insertList()
    const book = await insertBook()
    await secretClient()
      .from('list_entries')
      .insert({ list_id: list.id, book_id: book.id, source_key: '2025:1', year: 2025 })
      .throwOnError()

    const { error } = await secretClient().from('books').delete().eq('id', book.id)

    expect(error?.code).toBe('23503')
  })

  it('sets updated_at when an entry changes', async () => {
    const list = await insertList()
    const book = await insertBook()
    await secretClient()
      .from('list_entries')
      .insert({ list_id: list.id, book_id: book.id, source_key: '2025:1', year: 2025 })
      .throwOnError()
    await sql("update public.list_entries set updated_at = now() - interval '1 day'")
    const [before] = await sql<{ updated_at: Date }>('select updated_at from public.list_entries')

    await secretClient().from('list_entries').update({ edition: 'fall' }).eq('source_key', '2025:1').throwOnError()

    const [after] = await sql<{ updated_at: Date }>('select updated_at from public.list_entries')
    expect(after.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime())
  })
})
