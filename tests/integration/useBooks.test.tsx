// ABOUTME: Integration tests for loading the catalog merged with the reader's statuses.
// ABOUTME: Renders the hook against the local Supabase stack as a signed-in reader.
// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { useBooks } from '../../src/books/useBooks.ts'
import { createAppSupabaseClient } from '../../src/data/supabaseClient.ts'
import { applyStatusChange } from '../../src/data/statuses.ts'
import { fixtureEntries, runImport } from './catalogFixtures.ts'
import { createAppWrapper } from './queryWrapper.tsx'
import { createTestUser, resetDatabase, sql } from './supabase.ts'

async function bookIdFor(sourceKey: string): Promise<string> {
  const rows = await sql<{ book_id: string }>('select book_id from public.list_entries where source_key = $1', [sourceKey])
  return rows[0].book_id
}

describe('useBooks', () => {
  beforeEach(async () => {
    await resetDatabase()
    await runImport(fixtureEntries)
  })

  it('returns every book with the reader’s status attached', async () => {
    const { user, client } = await createTestUser()
    const readBookId = await bookIdFor('2025:31')
    await applyStatusChange(client, user.id, readBookId, {
      kind: 'save',
      record: { status: 'read', dateRead: '2025-06-14', ratingQuarters: 15 },
    })

    const { result } = renderHook(() => useBooks(user.id), createAppWrapper(client))

    await waitFor(() => expect(result.current.state).toBe('ready'))
    expect(result.current.books).toHaveLength(26)
    const read = result.current.books.find((book) => book.bookId === readBookId)
    expect(read).toMatchObject({
      title: 'Baldwin: A Love Story',
      status: { status: 'read', dateRead: '2025-06-14', ratingQuarters: 15 },
    })
    expect(result.current.books.filter((book) => book.status === null)).toHaveLength(25)
  })

  it('reports loading before the data arrives', async () => {
    const { user, client } = await createTestUser()

    const { result } = renderHook(() => useBooks(user.id), createAppWrapper(client))

    expect(result.current).toEqual({ state: 'loading', books: [] })
    await waitFor(() => expect(result.current.state).toBe('ready'))
  })

  describe('with a paused backend', () => {
    let pausedServer: Server
    let pausedUrl: string

    beforeAll(async () => {
      pausedServer = createServer((_request, response) => {
        response.writeHead(540, { 'content-type': 'text/plain' }).end('Project paused')
      })
      await new Promise<void>((resolve) => pausedServer.listen(0, '127.0.0.1', resolve))
      pausedUrl = `http://127.0.0.1:${(pausedServer.address() as AddressInfo).port}`
    })

    afterAll(async () => {
      await new Promise((resolve) => pausedServer.close(resolve))
    })

    it('explains how to restore the project, and logs the error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const client = createAppSupabaseClient(pausedUrl, 'sb_publishable_test', { storageKey: `paused-${crypto.randomUUID()}` })

      const { result } = renderHook(() => useBooks('some-user'), createAppWrapper(client))

      await waitFor(() => expect(result.current.state).toBe('failed'))
      expect(result.current).toMatchObject({
        books: [],
        message: 'The Supabase project is paused. Restore it from the Supabase dashboard, then try again.',
      })
      expect(consoleError).toHaveBeenCalledWith('Could not load books', expect.objectContaining({ reason: 'paused' }))
    })
  })
})
