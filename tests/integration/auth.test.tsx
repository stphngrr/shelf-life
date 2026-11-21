// ABOUTME: Integration tests for signing in with a magic link and signing out.
// ABOUTME: Renders the real UI against the local Supabase auth server; Mailpit catches the emails.
// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import App from '../../src/App.tsx'
import { LoginScreen } from '../../src/auth/LoginScreen.tsx'
import { SupabaseProvider } from '../../src/data/SupabaseProvider.tsx'
import { createAppSupabaseClient } from '../../src/data/supabaseClient.ts'
import { clearMailbox, countMessagesTo, magicLinkSentTo } from './mailpit.ts'
import { createAppWrapper } from './queryWrapper.tsx'
import { createTestUser, resetDatabase, secretClient } from './supabase.ts'

/** The app's real client configuration, with its own session storage so tests don't share one. */
function appClient(url = process.env.VITE_SUPABASE_URL!) {
  return createAppSupabaseClient(url, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    storageKey: `app-test-${crypto.randomUUID()}`,
  })
}

async function requestLink(email: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.click(screen.getByRole('button', { name: 'Email me a sign-in link' }))
}

async function registeredEmail(): Promise<string> {
  const { user } = await createTestUser()
  return user.email!
}

describe('signing in', () => {
  beforeEach(async () => {
    await resetDatabase()
    await clearMailbox()
    localStorage.clear()
  })

  it('emails a sign-in link to a registered reader', async () => {
    const email = await registeredEmail()
    render(
      <SupabaseProvider client={appClient()}>
        <LoginScreen />
      </SupabaseProvider>,
    )

    await requestLink(email)

    expect(await screen.findByText(`We sent a sign-in link to ${email}. Open it in this browser.`)).toBeInTheDocument()
    expect(await magicLinkSentTo(email)).toContain('/auth/v1/verify')
  })

  it('signs in through a one-time code in the query string, leaving the URL hash alone', async () => {
    const email = await registeredEmail()
    const client = appClient()
    render(
      <SupabaseProvider client={client}>
        <LoginScreen />
      </SupabaseProvider>,
    )
    await requestLink(email)
    await screen.findByText(`We sent a sign-in link to ${email}. Open it in this browser.`)

    const verify = await fetch(await magicLinkSentTo(email), { redirect: 'manual' })
    const redirect = new URL(verify.headers.get('location')!)

    expect(redirect.origin).toBe(window.location.origin)
    expect(redirect.hash).toBe('')
    const code = redirect.searchParams.get('code')
    expect(code).toEqual(expect.any(String))
    const { data, error } = await client.auth.exchangeCodeForSession(code!)
    expect(error).toBeNull()
    expect(data.session?.user.email).toBe(email)
  })

  it('explains when no account exists for the email, sending nothing', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <SupabaseProvider client={appClient()}>
        <LoginScreen />
      </SupabaseProvider>,
    )

    await requestLink('stranger@example.com')

    expect(await screen.findByRole('alert')).toHaveTextContent('No account exists for stranger@example.com.')
    expect(await countMessagesTo('stranger@example.com')).toBe(0)
    expect(consoleError).toHaveBeenCalledWith('Magic link request failed', expect.objectContaining({ code: 'otp_disabled' }))
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
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
      render(
        <SupabaseProvider client={appClient(pausedUrl)}>
          <LoginScreen />
        </SupabaseProvider>,
      )

      await requestLink('reader@example.com')

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The Supabase project is paused. Restore it from the Supabase dashboard, then try again.',
      )
      expect(consoleError).toHaveBeenCalledWith('Magic link request failed', expect.objectContaining({ status: 540 }))
    })
  })
})

describe('the app shell', () => {
  beforeEach(async () => {
    await resetDatabase()
    localStorage.clear()
  })

  it('shows the sign-in screen to a signed-out visitor', async () => {
    render(<App />, { wrapper: createAppWrapper(appClient()).wrapper })

    expect(await screen.findByRole('button', { name: 'Email me a sign-in link' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'shelf-life' })).toBeInTheDocument()
  })

  it('lets a signed-in reader sign out', async () => {
    const { user } = await createTestUser()
    const client = appClient()
    const { data } = await secretClient().auth.admin.generateLink({ type: 'magiclink', email: user.email! })
    await client.auth.verifyOtp({ token_hash: data.properties!.hashed_token, type: 'magiclink' })
    render(<App />, { wrapper: createAppWrapper(client).wrapper })

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Sign out' }))

    expect(await screen.findByRole('button', { name: 'Email me a sign-in link' })).toBeInTheDocument()
    expect((await client.auth.getSession()).data.session).toBeNull()
  })
})
