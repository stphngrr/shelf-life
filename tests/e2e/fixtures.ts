// ABOUTME: Shared setup for end-to-end tests: a fresh database, a reader account, and magic-link sign-in.
// ABOUTME: Also fails any test whose browser logs an error or warning, keeping output pristine.

import { test as base, expect, type Page } from '@playwright/test'
import { fixtureEntries, runImport } from '../integration/catalogFixtures.ts'
import { clearMailbox, magicLinkSentTo } from '../integration/mailpit.ts'
import { resetDatabase, secretClient } from '../integration/supabase.ts'

export const READER_EMAIL = 'e2e-reader@example.com'

/** Signs in through the real sign-in screen and the emailed magic link, opened in the same browser. */
export async function signIn(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByLabel('Email').fill(READER_EMAIL)
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click()
  await expect(page.getByText(`We sent a sign-in link to ${READER_EMAIL}.`)).toBeVisible()
  await page.goto(await magicLinkSentTo(READER_EMAIL))
  await expect(page.getByRole('status')).toHaveText('26 books')
}

export const test = base.extend<{ browserProblems: string[] }>({
  browserProblems: [
    async ({ page }, use) => {
      const problems: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          problems.push(`console.${message.type()}: ${message.text()}`)
        }
      })
      page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
      await use(problems)
      expect(problems, 'browser logged unexpected errors or warnings').toEqual([])
    },
    { auto: true },
  ],
})

test.beforeEach(async () => {
  await resetDatabase()
  await runImport(fixtureEntries)
  const { error } = await secretClient().auth.admin.createUser({ email: READER_EMAIL, email_confirm: true })
  if (error) throw error
  await clearMailbox()
})

export { expect }
