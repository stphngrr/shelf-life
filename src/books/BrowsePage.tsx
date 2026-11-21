// ABOUTME: The signed-in browsing page: filters the catalog and shows matching books to mark.
// ABOUTME: Filters live in the URL hash; books and statuses come from useBooks; marks save optimistically.

import { useCallback, useMemo, useState } from 'react'
import { catalogFacets } from '../lib/facets.ts'
import { filterBooks } from '../lib/filters.ts'
import { sortBooks } from '../lib/sortBooks.ts'
import { toggleStatus, updateReadDetails, type ReadDetails } from '../lib/statusTransitions.ts'
import { filtersToHash } from '../lib/urlState.ts'
import type { BookStatus } from '../types/catalog.ts'
import { BookGrid } from './BookGrid.tsx'
import { BookList } from './BookList.tsx'
import { DetailPanel } from './DetailPanel.tsx'
import { FilterBar } from './FilterBar.tsx'
import { useBooks, type BrowseBook } from './useBooks.ts'
import { useFilters } from './useFilters.ts'
import { useSetBookStatus } from './useSetBookStatus.ts'
import { useViewMode } from './useViewMode.ts'
import { ViewToggle } from './ViewToggle.tsx'

/** How many books to show at first, and how many more each "Show more" adds. */
const PAGE_SIZE = 60

export function BrowsePage({ userId }: { userId: string }) {
  const books = useBooks(userId)
  const [filters, setFilters] = useFilters()
  const { setStatus, errorMessage, dismissError } = useSetBookStatus(userId)
  const [viewMode, setViewMode] = useViewMode()
  const BookView = viewMode === 'list' ? BookList : BookGrid
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const closePanel = useCallback(() => setOpenEntryId(null), [])
  // Taken from all books, not just matching ones, so the panel stays open if a change filters it out.
  const openBook = books.books.find((book) => book.entryId === openEntryId)

  const facets = useMemo(() => catalogFacets(books.books), [books.books])
  const sorted = useMemo(() => sortBooks(books.books), [books.books])
  const matching = useMemo(() => filterBooks(sorted, filters), [sorted, filters])

  // Each new set of filters starts again from the first page.
  const filterKey = filtersToHash(filters)
  const [shown, setShown] = useState({ filterKey, count: PAGE_SIZE })
  const shownCount = shown.filterKey === filterKey ? shown.count : PAGE_SIZE
  const remaining = matching.length - shownCount

  function handleToggleStatus(book: BrowseBook, target: BookStatus) {
    const { change, losesReadDetails } = toggleStatus(book.status, target)
    const confirmed =
      !losesReadDetails ||
      window.confirm(`Change the status of "${book.title}"? Its date read and rating will be cleared.`)
    if (confirmed) setStatus(book.bookId, change)
  }

  function handleUpdateReadDetails(book: BrowseBook, details: ReadDetails) {
    if (!book.status) return
    setStatus(book.bookId, { kind: 'save', record: updateReadDetails(book.status, details) })
  }

  if (books.state === 'loading') return <p className="text-gray-600">Loading books…</p>
  if (books.state === 'failed') {
    return (
      <p role="alert" className="text-red-700">
        {books.message}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <FilterBar
        filters={filters}
        years={facets.years}
        tags={facets.tags}
        resultCount={matching.length}
        onChange={setFilters}
      />
      {errorMessage && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-md bg-red-50 p-3 text-sm text-red-800">
          <p>{errorMessage}</p>
          <button type="button" onClick={dismissError} className="underline">
            Dismiss message
          </button>
        </div>
      )}
      <div className="flex justify-end">
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>
      <BookView
        books={matching.slice(0, shownCount)}
        onToggleStatus={handleToggleStatus}
        onOpen={(book) => setOpenEntryId(book.entryId)}
      />
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setShown({ filterKey, count: shownCount + PAGE_SIZE })}
          className="self-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:border-gray-500"
        >
          Show {Math.min(remaining, PAGE_SIZE)} more
        </button>
      )}
      {openBook && (
        <DetailPanel
          book={openBook}
          onClose={closePanel}
          onToggleStatus={handleToggleStatus}
          onUpdateReadDetails={handleUpdateReadDetails}
        />
      )}
    </div>
  )
}
