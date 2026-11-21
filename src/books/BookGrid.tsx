// ABOUTME: Cover grid of books, each with its title, author, status, and quick-mark buttons.
// ABOUTME: Presentational: reports status changes and requests to open a book to its parent.

import type { BookStatus } from '../types/catalog.ts'
import { BookCover } from './BookCover.tsx'
import { QuickMarkButtons } from './QuickMarkButtons.tsx'
import { StatusBadge } from './StatusBadge.tsx'
import type { BrowseBook } from './useBooks.ts'

/** Props shared by every way of showing a set of books. */
export interface BookViewProps {
  books: BrowseBook[]
  onToggleStatus: (book: BrowseBook, status: BookStatus) => void
  onOpen: (book: BrowseBook) => void
}

export function BookGrid({ books, onToggleStatus, onOpen }: BookViewProps) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {books.map((book) => (
        <li key={book.entryId}>
          <article aria-label={book.title} className="flex h-full flex-col gap-2">
            <button type="button" onClick={() => onOpen(book)} className="flex flex-col gap-2 text-left">
              <BookCover url={book.coverUrl} className="aspect-[2/3] w-full rounded" />
              <span className="line-clamp-2 text-sm font-semibold">{book.title}</span>
            </button>
            <p className="line-clamp-1 text-xs text-gray-600">{book.author}</p>
            <StatusBadge status={book.status} />
            <div className="mt-auto">
              <QuickMarkButtons current={book.status?.status ?? null} onToggle={(status) => onToggleStatus(book, status)} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  )
}
