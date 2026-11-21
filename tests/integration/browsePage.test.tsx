// ABOUTME: Integration tests for the signed-in browse page and the app around it.
// ABOUTME: Renders the real app against the local Supabase stack with the NPR fixture imported.
// @vitest-environment jsdom

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import App from '../../src/App.tsx'
import { BrowsePage } from '../../src/books/BrowsePage.tsx'
import { statusesQueryKey } from '../../src/books/useBooks.ts'
import { createAppSupabaseClient, type AppSupabaseClient } from '../../src/data/supabaseClient.ts'
import { fixtureEntries, runImport, syntheticEntries } from './catalogFixtures.ts'
import { createAppWrapper } from './queryWrapper.tsx'
import { createTestUser, resetDatabase, secretClient, sql } from './supabase.ts'

function appClient(url = process.env.VITE_SUPABASE_URL!) {
  return createAppSupabaseClient(url, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    storageKey: `app-test-${crypto.randomUUID()}`,
  })
}

/** Signs the app client in as a new reader, the way a magic link would. */
async function signedInAppClient(): Promise<{ client: AppSupabaseClient; userId: string }> {
  const { user } = await createTestUser()
  const client = appClient()
  const { data } = await secretClient().auth.admin.generateLink({ type: 'magiclink', email: user.email! })
  const { error } = await client.auth.verifyOtp({ token_hash: data.properties!.hashed_token, type: 'magiclink' })
  if (error) throw error
  return { client, userId: user.id }
}

describe('browse page', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    await resetDatabase()
    await runImport(fixtureEntries)
  })

  it('shows every year in the catalog and the number of matching books', async () => {
    const { client, userId } = await signedInAppClient()
    const { wrapper: Wrapper } = createAppWrapper(client)

    render(<BrowsePage userId={userId} />, { wrapper: Wrapper })

    expect(await screen.findByRole('status')).toHaveTextContent('26 books')
    const years = within(screen.getByRole('group', { name: 'Years' })).getAllByRole('button')
    expect(years.map((b) => b.textContent)).toEqual([
      '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018', '2013',
    ])
  })

  it('narrows the books by year and records the filter in the URL', async () => {
    const { client, userId } = await signedInAppClient()
    const { wrapper: Wrapper } = createAppWrapper(client)
    render(<BrowsePage userId={userId} />, { wrapper: Wrapper })
    await screen.findByText('26 books')

    await userEvent.setup().click(within(screen.getByRole('group', { name: 'Years' })).getByRole('button', { name: '2024' }))

    expect(screen.getByRole('status')).toHaveTextContent('4 books')
    expect(window.location.hash).toBe('#years=2024')
  })

  it('starts from filters already in the URL', async () => {
    window.history.replaceState(null, '', '/#years=2013')
    const { client, userId } = await signedInAppClient()
    const { wrapper: Wrapper } = createAppWrapper(client)

    render(<BrowsePage userId={userId} />, { wrapper: Wrapper })

    expect(await screen.findByRole('status')).toHaveTextContent('1 book')
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

    it('explains how to restore the project', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { wrapper: Wrapper } = createAppWrapper(appClient(pausedUrl))

      render(<BrowsePage userId="some-user" />, { wrapper: Wrapper })

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The Supabase project is paused. Restore it from the Supabase dashboard, then try again.',
      )
    })
  })
})

describe('browsing and marking books', () => {
  let client: AppSupabaseClient
  let userId: string

  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    await resetDatabase()
  })

  async function renderPage() {
    ;({ client, userId } = await signedInAppClient())
    const { wrapper: Wrapper } = createAppWrapper(client)
    render(<BrowsePage userId={userId} />, { wrapper: Wrapper })
    await screen.findByRole('status')
    return userEvent.setup()
  }

  function card(title: string) {
    return within(screen.getByRole('article', { name: title }))
  }

  async function storedStatus(title: string) {
    const rows = await sql(
      `select s.status, s.date_read::text as date_read, s.rating_quarters from public.book_statuses s
       join public.books b on b.id = s.book_id where b.title = $1`,
      [title],
    )
    return rows[0] ?? null
  }

  it('shows books newest year first, then by title', async () => {
    await runImport(fixtureEntries)
    await renderPage()

    const titles = screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))
    expect(titles.slice(0, 2)).toEqual(['A Book of Maps for You', 'An Oral History of Atlantis: Stories'])
    expect(titles.at(-1)).toBe('A Constellation Of Vital Phenomena: A Novel')
  })

  it('shows 60 books at a time', async () => {
    await runImport(syntheticEntries(70))
    const user = await renderPage()

    expect(screen.getAllByRole('article')).toHaveLength(60)
    await user.click(screen.getByRole('button', { name: 'Show 10 more' }))

    expect(screen.getAllByRole('article')).toHaveLength(70)
    expect(screen.queryByRole('button', { name: /^Show \d+ more$/ })).toBeNull()
  })

  it('starts again from the first 60 when the filters change', async () => {
    await runImport(syntheticEntries(70))
    const user = await renderPage()
    await user.click(screen.getByRole('button', { name: 'Show 10 more' }))

    await user.click(within(screen.getByRole('group', { name: 'Status' })).getByRole('button', { name: 'Dismissed' }))

    expect(screen.getAllByRole('article')).toHaveLength(60)
  })

  it('marks a book read with one tap and saves it', async () => {
    await runImport(fixtureEntries)
    const user = await renderPage()

    await user.click(card('Baldwin: A Love Story').getByRole('button', { name: 'Read' }))

    expect(card('Baldwin: A Love Story').getByTestId('status-badge')).toHaveTextContent('Read')
    await waitFor(async () =>
      expect(await storedStatus('Baldwin: A Love Story')).toEqual({ status: 'read', date_read: null, rating_quarters: null }),
    )
  })

  it('hides a dismissed book from the default view', async () => {
    await runImport(fixtureEntries)
    const user = await renderPage()

    await user.click(card('Baldwin: A Love Story').getByRole('button', { name: 'Dismiss' }))

    expect(screen.queryByRole('article', { name: 'Baldwin: A Love Story' })).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('25 books')
    await waitFor(async () => expect((await storedStatus('Baldwin: A Love Story'))?.status).toBe('dismissed'))
  })

  describe('leaving Read on a book with a date or rating', () => {
    async function renderWithRatedBook() {
      await runImport(fixtureEntries)
      ;({ client, userId } = await signedInAppClient())
      await sql(
        `insert into public.book_statuses (user_id, book_id, status, date_read, rating_quarters)
         select $1, b.id, 'read', '2025-06-14', 15 from public.books b where b.title = 'Baldwin: A Love Story'`,
        [userId],
      )
      const { wrapper: Wrapper } = createAppWrapper(client)
      render(<BrowsePage userId={userId} />, { wrapper: Wrapper })
      await screen.findByRole('status')
      return userEvent.setup()
    }

    it('keeps the date and rating when the reader declines', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = await renderWithRatedBook()

      await user.click(card('Baldwin: A Love Story').getByRole('button', { name: 'Want' }))

      expect(confirm).toHaveBeenCalledWith(
        'Change the status of "Baldwin: A Love Story"? Its date read and rating will be cleared.',
      )
      expect(card('Baldwin: A Love Story').getByTestId('status-badge')).toHaveTextContent('Read · ★ 3.75')
      expect(await storedStatus('Baldwin: A Love Story')).toEqual({
        status: 'read',
        date_read: '2025-06-14',
        rating_quarters: 15,
      })
    })

    it('clears them when the reader confirms', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = await renderWithRatedBook()

      await user.click(card('Baldwin: A Love Story').getByRole('button', { name: 'Want' }))

      await waitFor(async () =>
        expect(await storedStatus('Baldwin: A Love Story')).toEqual({
          status: 'want_to_read',
          date_read: null,
          rating_quarters: null,
        }),
      )
    })
  })

  it('explains a failed save and lets the reader dismiss the message', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    await runImport(fixtureEntries)
    const user = await renderPage()
    // With the account gone, the database rejects the status's reference to it.
    await secretClient().auth.admin.deleteUser(userId)

    await user.click(card('Baldwin: A Love Story').getByRole('button', { name: 'Read' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/^Could not save your change: /)
    expect(card('Baldwin: A Love Story').queryByTestId('status-badge')).toBeNull()
    expect(consoleError).toHaveBeenCalledWith('Could not save status', expect.anything())

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('signing out', () => {
  beforeEach(async () => {
    window.history.replaceState(null, '', '/')
    await resetDatabase()
    await runImport(fixtureEntries)
  })

  it('forgets the reader’s loaded statuses', async () => {
    const { client, userId } = await signedInAppClient()
    const { wrapper: Wrapper, queryClient } = createAppWrapper(client)
    render(<App />, { wrapper: Wrapper })
    await screen.findByText('26 books')
    expect(queryClient.getQueryData(statusesQueryKey(userId))).toBeDefined()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign out' }))

    await screen.findByRole('button', { name: 'Email me a sign-in link' })
    await waitFor(() => expect(queryClient.getQueryData(statusesQueryKey(userId))).toBeUndefined())
  })
})
