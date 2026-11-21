// ABOUTME: Tests for a book's full details: metadata, sanitized blurb, links, status, and read details.
// ABOUTME: The component is presentational; tests check what it shows and which changes it reports.

import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EntryDetail } from '../data/catalog.ts'
import type { StatusRecord } from '../types/catalog.ts'
import { BookDetails } from './BookDetails.tsx'
import type { BrowseBook } from './useBooks.ts'

function book(overrides: Partial<BrowseBook> = {}): BrowseBook {
  return {
    entryId: 'entry-31',
    bookId: 'book-31',
    title: 'Baldwin: A Love Story',
    author: 'Nicholas Boggs',
    year: 2025,
    edition: 'fall',
    tags: ['biography & memoir', 'identity & culture'],
    coverUrl: 'https://example.com/baldwin.jpg',
    removedFromSource: false,
    status: null,
    ...overrides,
  }
}

const detail: EntryDetail = {
  blurbHtml: '<p>A <em>sweeping</em> biography.</p>',
  reviewers: ['Ericka Taylor', 'Minh Lê'],
  externalLinks: {
    listPage: 'https://apps.npr.org/best-books/#year=2025&book=31',
    goodreads: 'https://www.goodreads.com/book/show/1',
    bookshop: 'https://bookshop.org/a/88656/9780374178710',
    appleBooks: 'https://goto.applebooks.apple/US/9780374178710?at=11l79Y',
    worldcat: 'https://www.worldcat.org/isbn/0374178712',
    stories: [{ source: 'NPR', text: 'A new James Baldwin biography', url: 'https://www.npr.org/story' }],
  },
}

const readRated: StatusRecord = { status: 'read', dateRead: '2025-06-14', ratingQuarters: 15 }

function renderDetails(props: { book?: BrowseBook; detail?: EntryDetail } = {}) {
  const onToggleStatus = vi.fn()
  const onUpdateReadDetails = vi.fn()
  render(
    <BookDetails
      book={props.book ?? book()}
      detail={props.detail ?? detail}
      onToggleStatus={onToggleStatus}
      onUpdateReadDetails={onUpdateReadDetails}
    />,
  )
  return { onToggleStatus, onUpdateReadDetails, user: userEvent.setup() }
}

describe('BookDetails', () => {
  it('shows the title, author, year, edition, and tags', () => {
    renderDetails()

    expect(screen.getByRole('heading', { name: 'Baldwin: A Love Story' })).toBeInTheDocument()
    expect(screen.getByText('Nicholas Boggs')).toBeInTheDocument()
    expect(screen.getByText('2025 · fall')).toBeInTheDocument()
    expect(screen.getByText('biography & memoir · identity & culture')).toBeInTheDocument()
  })

  it('names the reviewers', () => {
    renderDetails()

    expect(screen.getByText('Recommended by Ericka Taylor and Minh Lê')).toBeInTheDocument()
  })

  it('shows the blurb as formatted text', () => {
    renderDetails()

    expect(screen.getByText('sweeping').tagName).toBe('EM')
  })

  it('strips scripts and event handlers from the blurb', () => {
    renderDetails({
      detail: { ...detail, blurbHtml: '<p>Safe<script>window.hacked = true</script><img src="x" onerror="window.hacked = true"></p>' },
    })

    const blurb = screen.getByTestId('blurb')
    expect(blurb.querySelector('script')).toBeNull()
    expect(blurb.querySelector('img')?.getAttribute('onerror')).toBeNull()
    expect(blurb).toHaveTextContent('Safe')
  })

  it('links to the book on NPR, Goodreads, Bookshop, Apple Books, and WorldCat, in new tabs', () => {
    renderDetails()

    const links = within(screen.getByRole('list', { name: 'Find this book' })).getAllByRole('link')
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['NPR', 'https://apps.npr.org/best-books/#year=2025&book=31'],
      ['Goodreads', 'https://www.goodreads.com/book/show/1'],
      ['Bookshop', 'https://bookshop.org/a/88656/9780374178710'],
      ['Apple Books', 'https://goto.applebooks.apple/US/9780374178710?at=11l79Y'],
      ['Find in a library', 'https://www.worldcat.org/isbn/0374178712'],
    ])
    expect(links.every((link) => link.getAttribute('target') === '_blank')).toBe(true)
    expect(links.every((link) => link.getAttribute('rel') === 'noopener noreferrer')).toBe(true)
  })

  it('leaves out sites the book has no link for', () => {
    renderDetails({ detail: { ...detail, externalLinks: { worldcat: 'https://www.worldcat.org/isbn/1', stories: [] } } })

    const links = within(screen.getByRole('list', { name: 'Find this book' })).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Find in a library'])
  })

  it('lists stories about the book with their source', () => {
    renderDetails()

    const story = within(screen.getByRole('list', { name: 'Stories' })).getByRole('link', {
      name: 'A new James Baldwin biography',
    })
    expect(story).toHaveAttribute('href', 'https://www.npr.org/story')
    expect(story.closest('li')).toHaveTextContent('NPR: A new James Baldwin biography')
  })

  it('notes when the book is no longer on NPR’s list', () => {
    renderDetails({ book: book({ removedFromSource: true }) })

    expect(screen.getByText('No longer on NPR’s list.')).toBeInTheDocument()
  })

  it('reports status changes for the book', async () => {
    const target = book()
    const { onToggleStatus, user } = renderDetails({ book: target })

    await user.click(screen.getByRole('button', { name: 'Want' }))

    expect(onToggleStatus).toHaveBeenCalledWith(target, 'want_to_read')
  })

  it('asks for a date and rating only once the book is read', () => {
    renderDetails({ book: book({ status: { status: 'want_to_read', dateRead: null, ratingQuarters: null } }) })

    expect(screen.queryByLabelText('Date read')).toBeNull()
    expect(screen.queryByLabelText('Rating')).toBeNull()
  })

  it('shows the date read and rating of a read book', () => {
    renderDetails({ book: book({ status: readRated }) })

    expect(screen.getByLabelText('Date read')).toHaveValue('2025-06-14')
    expect(screen.getByLabelText('Rating')).toHaveValue('15')
    expect(screen.getByTestId('star-rating')).toHaveAttribute('data-fills', '1,1,1,0.75,0')
  })

  it('offers every quarter-star rating from 5 down to 0, plus not rated', () => {
    renderDetails({ book: book({ status: readRated }) })

    const options = within(screen.getByLabelText('Rating')).getAllByRole('option')
    expect(options).toHaveLength(22)
    expect(options.slice(0, 3).map((o) => o.textContent)).toEqual(['Not rated', '5 ★', '4.75 ★'])
    expect(options.at(-1)?.textContent).toBe('0 ★')
  })

  it('reports a new rating', async () => {
    const target = book({ status: readRated })
    const { onUpdateReadDetails, user } = renderDetails({ book: target })

    await user.selectOptions(screen.getByLabelText('Rating'), '3.25 ★')

    expect(onUpdateReadDetails).toHaveBeenCalledWith(target, { ratingQuarters: 13 })
  })

  it('reports clearing the rating', async () => {
    const target = book({ status: readRated })
    const { onUpdateReadDetails, user } = renderDetails({ book: target })

    await user.selectOptions(screen.getByLabelText('Rating'), 'Not rated')

    expect(onUpdateReadDetails).toHaveBeenCalledWith(target, { ratingQuarters: null })
  })

  // A date picker sets the whole date at once, so these fire a single change, as the picker does.
  it('reports a new date read', () => {
    const target = book({ status: { status: 'read', dateRead: null, ratingQuarters: null } })
    const { onUpdateReadDetails } = renderDetails({ book: target })

    fireEvent.change(screen.getByLabelText('Date read'), { target: { value: '2025-07-04' } })

    expect(onUpdateReadDetails).toHaveBeenCalledWith(target, { dateRead: '2025-07-04' })
  })

  it('reports clearing the date read', () => {
    const target = book({ status: readRated })
    const { onUpdateReadDetails } = renderDetails({ book: target })

    fireEvent.change(screen.getByLabelText('Date read'), { target: { value: '' } })

    expect(onUpdateReadDetails).toHaveBeenCalledWith(target, { dateRead: null })
  })
})
