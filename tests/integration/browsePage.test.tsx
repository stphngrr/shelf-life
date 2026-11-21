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
import { fixtureEntries, runImport } from './catalogFixtures.ts'
import { createAppWrapper } from './queryWrapper.tsx'
import { createTestUser, resetDatabase, secretClient } from './supabase.ts'

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
