// ABOUTME: End-to-end tests of the reader's main journeys in a real browser against local Supabase.
// ABOUTME: Signs in by magic link, filters, marks books, records read details, and checks they persist.

import { expect, signIn, test } from './fixtures.ts'

test('signs in with a magic link and shows the catalog', async ({ page }) => {
  await signIn(page)

  await expect(page.getByRole('heading', { level: 1, name: 'shelf-life' })).toBeVisible()
  await expect(page).not.toHaveURL(/code=/)
})

test('keeps a year filter in the URL across a reload', async ({ page }) => {
  await signIn(page)

  await page.getByRole('group', { name: 'Years' }).getByRole('button', { name: '2024' }).click()
  await expect(page.getByRole('status')).toHaveText('4 books')
  await expect(page).toHaveURL(/#years=2024$/)
  await page.reload()

  await expect(page.getByRole('status')).toHaveText('4 books')
  await expect(page.getByRole('group', { name: 'Years' }).getByRole('button', { name: '2024' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('goes back to the previous filters with the back button', async ({ page }) => {
  await signIn(page)
  await page.getByRole('group', { name: 'Years' }).getByRole('button', { name: '2024' }).click()
  await expect(page.getByRole('status')).toHaveText('4 books')

  await page.goBack()

  await expect(page.getByRole('status')).toHaveText('26 books')
})

test('saves a quick mark across a reload', async ({ page }) => {
  await signIn(page)
  const baldwin = page.getByRole('article', { name: 'Baldwin: A Love Story' })

  await baldwin.getByRole('button', { name: 'Want' }).click()
  await expect(baldwin.getByTestId('status-badge')).toHaveText('Want to read')
  await page.reload()

  await expect(page.getByRole('article', { name: 'Baldwin: A Love Story' }).getByTestId('status-badge')).toHaveText(
    'Want to read',
  )
})

test('records a book as read with a date and a rating', async ({ page }) => {
  await signIn(page)
  await page.getByRole('article', { name: 'Baldwin: A Love Story' }).getByRole('button', { name: 'Baldwin: A Love Story' }).click()
  const panel = page.getByRole('dialog', { name: 'Baldwin: A Love Story' })
  await expect(panel.getByTestId('blurb')).toContainText('The book is massive at 720 pages')

  await panel.getByRole('button', { name: 'Read' }).click()
  await panel.getByLabel('Date read').fill('2025-06-14')
  await panel.getByLabel('Rating').selectOption({ label: '3.75 ★' })
  await expect(panel.getByLabel('Rating')).toHaveValue('15')
  await page.reload()

  const baldwin = page.getByRole('article', { name: 'Baldwin: A Love Story' })
  await expect(baldwin.getByTestId('status-badge')).toHaveText('Read · ★ 3.75')
  await baldwin.getByRole('button', { name: 'Baldwin: A Love Story' }).click()
  const reopened = page.getByRole('dialog', { name: 'Baldwin: A Love Story' })
  await expect(reopened.getByLabel('Date read')).toHaveValue('2025-06-14')
  await expect(reopened.getByLabel('Rating')).toHaveValue('15')
})

test('hides dismissed books until the Dismissed filter is on', async ({ page }) => {
  await signIn(page)

  await page.getByRole('article', { name: 'Baldwin: A Love Story' }).getByRole('button', { name: 'Dismiss' }).click()
  await expect(page.getByRole('article', { name: 'Baldwin: A Love Story' })).toHaveCount(0)
  await expect(page.getByRole('status')).toHaveText('25 books')
  await page.reload()
  await expect(page.getByRole('status')).toHaveText('25 books')

  await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Dismissed' }).click()

  await expect(page.getByRole('article', { name: 'Baldwin: A Love Story' }).getByTestId('status-badge')).toHaveText(
    'Dismissed',
  )
})

test('finds a book by searching for its author without accents', async ({ page }) => {
  await signIn(page)

  await page.getByRole('searchbox', { name: 'Search titles and authors' }).fill('canas')

  await expect(page.getByRole('status')).toHaveText('1 book')
  await expect(page.getByRole('article', { name: 'The Hacienda' })).toBeVisible()
})

test('stays signed out after signing out and reloading', async ({ page }) => {
  await signIn(page)

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible()
  await page.reload()

  await expect(page.getByRole('button', { name: 'Email me a sign-in link' })).toBeVisible()
})
