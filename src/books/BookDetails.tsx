// ABOUTME: A book's full details: metadata, NPR's blurb, outside links, status, and read details.
// ABOUTME: Presentational: reports status and read-detail changes to its parent; sanitizes the blurb HTML.

import DOMPurify from 'dompurify'
import { useId } from 'react'
import type { EntryDetail } from '../data/catalog.ts'
import { formatStars } from '../lib/rating.ts'
import type { ReadDetails } from '../lib/statusTransitions.ts'
import type { BookStatus, ExternalLinks } from '../types/catalog.ts'
import { BookCover } from './BookCover.tsx'
import { QuickMarkButtons } from './QuickMarkButtons.tsx'
import { StarRating } from './StarRating.tsx'
import type { BrowseBook } from './useBooks.ts'

interface BookDetailsProps {
  book: BrowseBook
  detail: EntryDetail
  onToggleStatus: (book: BrowseBook, status: BookStatus) => void
  onUpdateReadDetails: (book: BrowseBook, details: ReadDetails) => void
}

const SITE_LINKS: { key: Exclude<keyof ExternalLinks, 'stories'>; label: string }[] = [
  { key: 'listPage', label: 'NPR' },
  { key: 'goodreads', label: 'Goodreads' },
  { key: 'bookshop', label: 'Bookshop' },
  { key: 'appleBooks', label: 'Apple Books' },
  { key: 'worldcat', label: 'Find in a library' },
]

// Ratings from 5 stars down to 0, in quarter steps.
const RATING_QUARTERS = Array.from({ length: 21 }, (_, i) => 20 - i)

const listFormat = new Intl.ListFormat('en', { type: 'conjunction' })

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-gray-900 underline">
      {children}
    </a>
  )
}

function ReadDetailsForm({ book, onUpdate }: { book: BrowseBook; onUpdate: (details: ReadDetails) => void }) {
  const dateRead = book.status?.dateRead ?? ''
  const ratingQuarters = book.status?.ratingQuarters ?? null
  const ratingId = useId()

  return (
    <div className="flex flex-col gap-3 rounded-md bg-gray-50 p-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-gray-700">Date read</span>
        <input
          type="date"
          value={dateRead}
          onChange={(event) => onUpdate({ dateRead: event.target.value || null })}
          className="rounded-md border border-gray-300 px-2 py-1"
        />
      </label>
      <div className="flex flex-col gap-1 text-sm">
        <label htmlFor={ratingId} className="font-medium text-gray-700">
          Rating
        </label>
        <span className="flex items-center gap-3">
          <select
            id={ratingId}
            value={ratingQuarters === null ? '' : String(ratingQuarters)}
            onChange={(event) =>
              onUpdate({ ratingQuarters: event.target.value === '' ? null : Number(event.target.value) })
            }
            className="rounded-md border border-gray-300 px-2 py-1"
          >
            <option value="">Not rated</option>
            {RATING_QUARTERS.map((quarters) => (
              <option key={quarters} value={quarters}>
                {formatStars(quarters)} ★
              </option>
            ))}
          </select>
          {ratingQuarters !== null && <StarRating quarters={ratingQuarters} />}
        </span>
      </div>
    </div>
  )
}

export function BookDetails({ book, detail, onToggleStatus, onUpdateReadDetails }: BookDetailsProps) {
  const links = detail.externalLinks
  const siteLinks = SITE_LINKS.filter(({ key }) => links[key])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-4">
        <BookCover url={book.coverUrl} className="h-48 w-32 shrink-0 rounded" />
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">
            {book.title}
          </h2>
          <p className="text-gray-700">{book.author}</p>
          <p className="text-sm text-gray-500">{book.edition ? `${book.year} · ${book.edition}` : book.year}</p>
          <p className="text-sm text-gray-500">{book.tags.join(' · ')}</p>
          {book.removedFromSource && <p className="text-sm text-amber-700">No longer on NPR’s list.</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <QuickMarkButtons current={book.status?.status ?? null} onToggle={(status) => onToggleStatus(book, status)} />
        {book.status?.status === 'read' && (
          <ReadDetailsForm book={book} onUpdate={(details) => onUpdateReadDetails(book, details)} />
        )}
      </div>

      {detail.reviewers.length > 0 && (
        <p className="text-sm text-gray-600">Recommended by {listFormat.format(detail.reviewers)}</p>
      )}

      {detail.blurbHtml && (
        <div
          data-testid="blurb"
          className="flex flex-col gap-3 text-gray-800"
          // NPR's blurb is HTML; DOMPurify removes scripts, event handlers, and other unsafe markup.
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(detail.blurbHtml) }}
        />
      )}

      {siteLinks.length > 0 && (
        <ul aria-label="Find this book" className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {siteLinks.map(({ key, label }) => (
            <li key={key}>
              <ExternalLink href={links[key]!}>{label}</ExternalLink>
            </li>
          ))}
        </ul>
      )}

      {links.stories.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-700">Stories</h3>
          <ul aria-label="Stories" className="flex flex-col gap-1 text-sm">
            {links.stories.map((story) => (
              <li key={story.url}>
                {story.source}: <ExternalLink href={story.url}>{story.text}</ExternalLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
