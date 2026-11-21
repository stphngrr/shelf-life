// ABOUTME: Tests for the cover grid: each book's cover, title, author, status badge, and quick-mark buttons.
// ABOUTME: The grid is presentational; tests check what it shows and which actions it reports.

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { StatusRecord } from '../types/catalog.ts'
import { BookGrid } from './BookGrid.tsx'
import type { BrowseBook } from './useBooks.ts'

function book(overrides: Partial<BrowseBook> = {}): BrowseBook {
  return {
    entryId: 'entry-1',
    bookId: 'book-1',
    title: 'The Hacienda',
    author: 'Isabel Cañas',
    year: 2022,
    edition: 'fall',
    tags: ['fiction'],
    coverUrl: 'https://example.com/hacienda.jpg',
    removedFromSource: false,
    status: null,
    ...overrides,
  }
}

const read: StatusRecord = { status: 'read', dateRead: '2025-06-14', ratingQuarters: 15 }

function renderGrid(books: BrowseBook[]) {
  const onToggleStatus = vi.fn()
  const onOpen = vi.fn()
  render(<BookGrid books={books} onToggleStatus={onToggleStatus} onOpen={onOpen} />)
  return { onToggleStatus, onOpen, user: userEvent.setup() }
}

function card(title: string) {
  return within(screen.getByRole('article', { name: title }))
}

describe('BookGrid', () => {
  it('shows each book’s cover, title, and author', () => {
    renderGrid([book()])

    const hacienda = card('The Hacienda')
    expect(hacienda.getByText('The Hacienda')).toBeInTheDocument()
    expect(hacienda.getByText('Isabel Cañas')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'The Hacienda' }).querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/hacienda.jpg',
    )
  })

  it('loads covers lazily', () => {
    renderGrid([book()])

    expect(screen.getByRole('article', { name: 'The Hacienda' }).querySelector('img')).toHaveAttribute('loading', 'lazy')
  })

  it('shows a placeholder when a book has no cover', () => {
    renderGrid([book({ coverUrl: null })])

    expect(screen.getByRole('article', { name: 'The Hacienda' }).querySelector('img')).toBeNull()
    expect(card('The Hacienda').getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('shows a placeholder when a cover fails to load', () => {
    renderGrid([book()])

    fireEvent.error(screen.getByRole('article', { name: 'The Hacienda' }).querySelector('img')!)

    expect(card('The Hacienda').getByTestId('cover-placeholder')).toBeInTheDocument()
  })

  it('shows the status of a marked book, with its rating', () => {
    renderGrid([book({ status: read })])

    expect(card('The Hacienda').getByTestId('status-badge')).toHaveTextContent('Read · ★ 3.75')
  })

  it('shows no status badge for an unmarked book', () => {
    renderGrid([book()])

    expect(card('The Hacienda').queryByTestId('status-badge')).toBeNull()
  })

  it('offers want, read, and dismiss buttons that show which status is active', () => {
    renderGrid([book({ status: read })])

    const quickMarks = card('The Hacienda')
      .getAllByRole('button')
      .filter((b) => b.hasAttribute('aria-pressed'))
    expect(quickMarks.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Want', 'false'],
      ['Read', 'true'],
      ['Dismiss', 'false'],
    ])
  })

  it.each([
    ['Want', 'want_to_read'],
    ['Read', 'read'],
    ['Dismiss', 'dismissed'],
  ])('reports the %s button for that book', async (label, status) => {
    const target = book()
    const { onToggleStatus, user } = renderGrid([target])

    await user.click(card('The Hacienda').getByRole('button', { name: label }))

    expect(onToggleStatus).toHaveBeenCalledWith(target, status)
  })

  it('opens a book’s details from its title', async () => {
    const target = book()
    const { onOpen, user } = renderGrid([target])

    await user.click(card('The Hacienda').getByRole('button', { name: 'The Hacienda' }))

    expect(onOpen).toHaveBeenCalledWith(target)
  })

  it('shows books in the order given', () => {
    renderGrid([book({ entryId: 'a', title: 'Second' }), book({ entryId: 'b', title: 'First' })])

    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Second', 'First'])
  })
})
