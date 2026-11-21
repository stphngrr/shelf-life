// ABOUTME: The signed-in browsing page: filters the catalog and shows the matching books.
// ABOUTME: Filters live in the URL hash; books and statuses come from useBooks.

import { useMemo } from 'react'
import { catalogFacets } from '../lib/facets.ts'
import { filterBooks } from '../lib/filters.ts'
import { FilterBar } from './FilterBar.tsx'
import { useBooks } from './useBooks.ts'
import { useFilters } from './useFilters.ts'

export function BrowsePage({ userId }: { userId: string }) {
  const books = useBooks(userId)
  const [filters, setFilters] = useFilters()
  const facets = useMemo(() => catalogFacets(books.books), [books.books])
  const matching = useMemo(() => filterBooks(books.books, filters), [books.books, filters])

  if (books.state === 'loading') return <p className="text-gray-600">Loading books…</p>
  if (books.state === 'failed') {
    return (
      <p role="alert" className="text-red-700">
        {books.message}
      </p>
    )
  }

  return (
    <FilterBar
      filters={filters}
      years={facets.years}
      tags={facets.tags}
      resultCount={matching.length}
      onChange={setFilters}
    />
  )
}
