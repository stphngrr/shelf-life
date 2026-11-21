// ABOUTME: Compact list of books, one row each, for scanning and marking many books quickly.
// ABOUTME: Presentational: reports status changes and requests to open a book to its parent.

import type { BookViewProps } from './BookGrid.tsx'
import { BookCover } from './BookCover.tsx'
import { QuickMarkButtons } from './QuickMarkButtons.tsx'
import { StatusBadge } from './StatusBadge.tsx'

export function BookList({ books, onToggleStatus, onOpen }: BookViewProps) {
  return (
    <ul className="divide-y divide-gray-200">
      {books.map((book) => (
        <li key={book.entryId}>
          <article aria-label={book.title} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
            <BookCover url={book.coverUrl} className="h-16 w-11 shrink-0 rounded" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <button
                type="button"
                onClick={() => onOpen(book)}
                className="line-clamp-2 text-left text-sm font-semibold hover:underline"
              >
                {book.title}
              </button>
              <p className="truncate text-xs text-gray-600">{book.author}</p>
              <p className="flex gap-2 text-xs text-gray-500">
                <span>{book.year}</span>
                <span className="truncate">{book.tags.join(' · ')}</span>
              </p>
              <StatusBadge status={book.status} />
            </div>
            {/* Below the title on phones, beside it on wider screens. */}
            <div className="w-full sm:w-40 sm:shrink-0">
              <QuickMarkButtons current={book.status?.status ?? null} onToggle={(status) => onToggleStatus(book, status)} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  )
}
