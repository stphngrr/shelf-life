// ABOUTME: Integration tests for saving a book's status with an optimistic update.
// ABOUTME: Runs against the local Supabase stack; failures come from real database constraints.
// @vitest-environment jsdom

import type { User } from '@supabase/supabase-js'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useBooks } from '../../src/books/useBooks.ts'
import { useSetBookStatus } from '../../src/books/useSetBookStatus.ts'
import type { AppSupabaseClient } from '../../src/data/supabaseClient.ts'
import type { StatusRecord } from '../../src/types/catalog.ts'
import { runImport, syntheticEntries } from './catalogFixtures.ts'
import { createAppWrapper } from './queryWrapper.tsx'
import { createTestUser, resetDatabase, sql } from './supabase.ts'

const wantToRead: StatusRecord = { status: 'want_to_read', dateRead: null, ratingQuarters: null }
// The database only allows a date read on read books, so saving this fails.
const invalidRecord: StatusRecord = { status: 'want_to_read', dateRead: '2025-06-14', ratingQuarters: null }

async function storedStatuses() {
  return sql('select book_id, status, date_read, rating_quarters from public.book_statuses order by book_id')
}

describe('useSetBookStatus', () => {
  let user: User
  let client: AppSupabaseClient
  let firstBookId: string
  let secondBookId: string

  beforeEach(async () => {
    await resetDatabase()
    await runImport(syntheticEntries(2))
    ;({ user, client } = await createTestUser())
    const books = await sql<{ id: string }>('select id from public.books order by id')
    ;[firstBookId, secondBookId] = books.map((book) => book.id)
  })

  function renderBooksAndSetter() {
    const seen: (string | null)[] = []
    const rendered = renderHook(() => {
      const books = useBooks(user.id)
      const setter = useSetBookStatus(user.id)
      const first = books.books.find((book) => book.bookId === firstBookId)
      if (first) seen.push(first.status?.status ?? null)
      return { books, setter }
    }, createAppWrapper(client))
    return { ...rendered, seen }
  }

  function statusOf(books: ReturnType<typeof useBooks>, bookId: string) {
    return books.books.find((book) => book.bookId === bookId)?.status ?? null
  }

  it('shows the new status and saves it', async () => {
    const { result } = renderBooksAndSetter()
    await waitFor(() => expect(result.current.books.state).toBe('ready'))

    act(() => result.current.setter.setStatus(firstBookId, { kind: 'save', record: wantToRead }))

    await waitFor(() => expect(statusOf(result.current.books, firstBookId)).toEqual(wantToRead))
    await waitFor(() => expect(result.current.setter.saving).toBe(false))
    expect(await storedStatuses()).toEqual([
      { book_id: firstBookId, status: 'want_to_read', date_read: null, rating_quarters: null },
    ])
  })

  it('unmarks a book', async () => {
    await sql("insert into public.book_statuses (user_id, book_id, status) values ($1, $2, 'dismissed')", [user.id, firstBookId])
    const { result } = renderBooksAndSetter()
    await waitFor(() => expect(result.current.books.state).toBe('ready'))

    act(() => result.current.setter.setStatus(firstBookId, { kind: 'remove' }))

    await waitFor(() => expect(statusOf(result.current.books, firstBookId)).toBeNull())
    await waitFor(() => expect(result.current.setter.saving).toBe(false))
    expect(await storedStatuses()).toEqual([])
  })

  it('shows the change at once, then rolls it back and explains when saving fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result, seen } = renderBooksAndSetter()
    await waitFor(() => expect(result.current.books.state).toBe('ready'))

    act(() => result.current.setter.setStatus(firstBookId, { kind: 'save', record: invalidRecord }))

    await waitFor(() => expect(result.current.setter.errorMessage).toMatch(/^Could not save your change: /))
    expect(statusOf(result.current.books, firstBookId)).toBeNull()
    expect(seen).toContain('want_to_read')
    expect(seen.at(-1)).toBeNull()
    expect(await storedStatuses()).toEqual([])
    expect(consoleError).toHaveBeenCalledWith(
      'Could not save status',
      expect.objectContaining({ message: expect.stringContaining('read_details_only_when_read') }),
    )
  })

  it('rolls back only the book whose save failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderBooksAndSetter()
    await waitFor(() => expect(result.current.books.state).toBe('ready'))

    act(() => {
      result.current.setter.setStatus(firstBookId, { kind: 'save', record: invalidRecord })
      result.current.setter.setStatus(secondBookId, { kind: 'save', record: wantToRead })
    })

    await waitFor(() => expect(result.current.setter.errorMessage).not.toBeNull())
    await waitFor(() => expect(result.current.setter.saving).toBe(false))
    expect(statusOf(result.current.books, firstBookId)).toBeNull()
    expect(statusOf(result.current.books, secondBookId)).toEqual(wantToRead)
  })

  it('clears the error message when asked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderBooksAndSetter()
    await waitFor(() => expect(result.current.books.state).toBe('ready'))
    act(() => result.current.setter.setStatus(firstBookId, { kind: 'save', record: invalidRecord }))
    await waitFor(() => expect(result.current.setter.errorMessage).not.toBeNull())

    act(() => result.current.setter.dismissError())

    expect(result.current.setter.errorMessage).toBeNull()
  })
})
