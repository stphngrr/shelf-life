// ABOUTME: Tests for the compact list view: one row per book with its details, status, and quick marks.
// ABOUTME: The list is presentational; tests check what it shows and which actions it reports.

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BookList } from './BookList.tsx'
import type { BrowseBook } from './useBooks.ts'

function book(overrides: Partial<BrowseBook> = {}): BrowseBook {
  return {
    entryId: 'entry-1',
    bookId: 'book-1',
    title: 'The Hacienda',
    author: 'Isabel Cañas',
    year: 2022,
    edition: 'fall',
    tags: ['fiction', 'the dark side'],
    coverUrl: 'https://example.com/hacienda.jpg',
    removedFromSource: false,
    status: null,
    ...overrides,
  }
}

function renderList(books: BrowseBook[]) {
  const onToggleStatus = vi.fn()
  const onOpen = vi.fn()
  render(<BookList books={books} onToggleStatus={onToggleStatus} onOpen={onOpen} />)
  return { onToggleStatus, onOpen, user: userEvent.setup() }
}

function row(title: string) {
  return within(screen.getByRole('article', { name: title }))
}

describe('BookList', () => {
  it('shows each book’s title, author, year, and tags', () => {
    renderList([book()])

    const hacienda = row('The Hacienda')
    expect(hacienda.getByText('Isabel Cañas')).toBeInTheDocument()
    expect(hacienda.getByText('2022')).toBeInTheDocument()
    expect(hacienda.getByText('fiction · the dark side')).toBeInTheDocument()
  })

  it('shows a small cover', () => {
    renderList([book()])

    expect(screen.getByRole('article', { name: 'The Hacienda' }).querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/hacienda.jpg',
    )
  })

  it('shows the status of a marked book', () => {
    renderList([book({ status: { status: 'want_to_read', dateRead: null, ratingQuarters: null } })])

    expect(row('The Hacienda').getByTestId('status-badge')).toHaveTextContent('Want to read')
  })

  it('reports a quick mark for that book', async () => {
    const target = book()
    const { onToggleStatus, user } = renderList([target])

    await user.click(row('The Hacienda').getByRole('button', { name: 'Dismiss' }))

    expect(onToggleStatus).toHaveBeenCalledWith(target, 'dismissed')
  })

  it('opens a book’s details from its title', async () => {
    const target = book()
    const { onOpen, user } = renderList([target])

    await user.click(row('The Hacienda').getByRole('button', { name: 'The Hacienda' }))

    expect(onOpen).toHaveBeenCalledWith(target)
  })
})
