// ABOUTME: Integration tests for opening a book's detail panel and editing its status and read details.
// ABOUTME: Renders the browse page against the local Supabase stack with the NPR fixture imported.
// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { BrowsePage } from '../../src/books/BrowsePage.tsx'
import { DetailPanel } from '../../src/books/DetailPanel.tsx'
import type { BrowseBook } from '../../src/books/useBooks.ts'
import { createAppSupabaseClient, type AppSupabaseClient } from '../../src/data/supabaseClient.ts'
import { fixtureEntries, runImport } from './catalogFixtures.ts'
import { createAppWrapper } from './queryWrapper.tsx'
import { createTestUser, resetDatabase, secretClient, sql } from './supabase.ts'

function appClient(url = process.env.VITE_SUPABASE_URL!) {
  return createAppSupabaseClient(url, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    storageKey: `app-test-${crypto.randomUUID()}`,
  })
}

async function signedInAppClient(): Promise<{ client: AppSupabaseClient; userId: string }> {
  const { user } = await createTestUser()
  const client = appClient()
  const { data } = await secretClient().auth.admin.generateLink({ type: 'magiclink', email: user.email! })
  const { error } = await client.auth.verifyOtp({ token_hash: data.properties!.hashed_token, type: 'magiclink' })
  if (error) throw error
  return { client, userId: user.id }
}

async function storedStatus(title: string) {
  const rows = await sql(
    `select s.status, s.date_read::text as date_read, s.rating_quarters from public.book_statuses s
     join public.books b on b.id = s.book_id where b.title = $1`,
    [title],
  )
  return rows[0] ?? null
}

describe('detail panel', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    localStorage.clear()
    await resetDatabase()
    await runImport(fixtureEntries)
  })

  async function openBaldwin() {
    const { client, userId } = await signedInAppClient()
    const { wrapper: Wrapper } = createAppWrapper(client)
    render(<BrowsePage userId={userId} />, { wrapper: Wrapper })
    await screen.findByRole('status')
    const user = userEvent.setup()
    const card = within(screen.getByRole('article', { name: 'Baldwin: A Love Story' }))
    await user.click(card.getByRole('button', { name: 'Baldwin: A Love Story' }))
    const dialog = await screen.findByRole('dialog', { name: 'Baldwin: A Love Story' })
    return { user, dialog: within(dialog) }
  }

  it('opens a book’s details, loading its blurb and reviewers', async () => {
    const { dialog } = await openBaldwin()

    expect(await dialog.findByText('Recommended by Adriana Gallardo')).toBeInTheDocument()
    expect(dialog.getByTestId('blurb')).toHaveTextContent('The book is massive at 720 pages')
  })

  it('moves focus into the panel when it opens', async () => {
    const { dialog } = await openBaldwin()

    expect(dialog.getByRole('button', { name: 'Close' })).toHaveFocus()
  })

  it('closes with the close button', async () => {
    const { user, dialog } = await openBaldwin()

    await user.click(dialog.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes with the Escape key', async () => {
    const { user } = await openBaldwin()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('records a book as read with a date and a rating', async () => {
    const { user, dialog } = await openBaldwin()
    await dialog.findByTestId('blurb')

    await user.click(dialog.getByRole('button', { name: 'Read' }))
    await user.selectOptions(await dialog.findByLabelText('Rating'), '4.25 ★')

    await waitFor(async () =>
      expect(await storedStatus('Baldwin: A Love Story')).toEqual({ status: 'read', date_read: null, rating_quarters: 17 }),
    )
    expect(within(screen.getByRole('article', { name: 'Baldwin: A Love Story' })).getByTestId('status-badge')).toHaveTextContent(
      'Read · ★ 4.25',
    )
  })

  it('stays open, showing the new status, when a book is dismissed from it', async () => {
    const { user, dialog } = await openBaldwin()
    await dialog.findByTestId('blurb')

    await user.click(dialog.getByRole('button', { name: 'Dismiss' }))

    expect(dialog.getByRole('button', { name: 'Dismiss' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('article', { name: 'Baldwin: A Love Story' })).toBeNull()
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

    it('explains why the details could not load, and logs the error', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const book: BrowseBook = {
        entryId: crypto.randomUUID(),
        bookId: crypto.randomUUID(),
        title: 'A Book',
        author: 'An Author',
        year: 2025,
        edition: null,
        tags: [],
        coverUrl: null,
        removedFromSource: false,
        status: null,
      }
      const { wrapper: Wrapper } = createAppWrapper(appClient(pausedUrl))

      render(<DetailPanel book={book} onClose={() => {}} onToggleStatus={() => {}} onUpdateReadDetails={() => {}} />, {
        wrapper: Wrapper,
      })

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The Supabase project is paused. Restore it from the Supabase dashboard, then try again.',
      )
      expect(consoleError).toHaveBeenCalledWith('Could not load book details', expect.objectContaining({ reason: 'paused' }))
    })
  })
})
