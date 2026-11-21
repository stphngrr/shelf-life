// ABOUTME: Tests for matching books against the browse filters: years, tags, status, and search.
// ABOUTME: Years combine with OR, tags with AND; search spans all years.

import type { BookStatus } from '../types/catalog.ts'
import {
  DEFAULT_FILTERS,
  filterBooks,
  isStatusIncluded,
  matchesFilters,
  toggleStatusFilter,
  type FilterableBook,
  type Filters,
} from './filters.ts'

type BookOverrides = Partial<Omit<FilterableBook, 'status'>> & { status?: BookStatus | null }

function book({ status = null, ...overrides }: BookOverrides = {}): FilterableBook {
  return {
    title: 'A Title',
    author: 'An Author',
    year: 2024,
    tags: ['fiction'],
    ...overrides,
    status: status ? { status } : null,
  }
}

function filters(overrides: Partial<Filters> = {}): Filters {
  return { ...DEFAULT_FILTERS, ...overrides }
}

describe('DEFAULT_FILTERS', () => {
  it('shows every year and every status except dismissed', () => {
    expect(DEFAULT_FILTERS).toEqual({
      years: [],
      tags: [],
      statuses: ['unmarked', 'want_to_read', 'read'],
      search: '',
    })
  })

  it.each([null, 'want_to_read', 'read'] as const)('matches a book whose status is %s', (status) => {
    expect(matchesFilters(book({ status }), DEFAULT_FILTERS)).toBe(true)
  })

  it('hides dismissed books', () => {
    expect(matchesFilters(book({ status: 'dismissed' }), DEFAULT_FILTERS)).toBe(false)
  })
})

describe('year filter', () => {
  it('matches only the selected year', () => {
    expect(matchesFilters(book({ year: 2024 }), filters({ years: [2024] }))).toBe(true)
    expect(matchesFilters(book({ year: 2023 }), filters({ years: [2024] }))).toBe(false)
  })

  it('matches any of several selected years', () => {
    expect(matchesFilters(book({ year: 2023 }), filters({ years: [2023, 2024] }))).toBe(true)
  })
})

describe('tag filter', () => {
  const mystery = book({ tags: ['fiction', 'mysteries & thrillers'] })

  it('matches a book with the selected tag', () => {
    expect(matchesFilters(mystery, filters({ tags: ['fiction'] }))).toBe(true)
  })

  it('requires every selected tag', () => {
    expect(matchesFilters(mystery, filters({ tags: ['fiction', 'mysteries & thrillers'] }))).toBe(true)
    expect(matchesFilters(mystery, filters({ tags: ['fiction', 'love & romance'] }))).toBe(false)
  })
})

describe('status filter', () => {
  it.each<[BookStatus | null, boolean]>([
    [null, false],
    ['want_to_read', false],
    ['read', true],
    ['dismissed', false],
  ])('with only "read" selected, a %s book matches: %s', (status, expected) => {
    expect(matchesFilters(book({ status }), filters({ statuses: ['read'] }))).toBe(expected)
  })

  it('treats a book with no status as unmarked', () => {
    expect(matchesFilters(book({ status: null }), filters({ statuses: ['unmarked'] }))).toBe(true)
    expect(matchesFilters(book({ status: 'read' }), filters({ statuses: ['unmarked'] }))).toBe(false)
  })

  it('matches every status, including dismissed, when none is selected', () => {
    expect(matchesFilters(book({ status: 'dismissed' }), filters({ statuses: [] }))).toBe(true)
  })
})

describe('search', () => {
  const baldwin = book({ title: 'Baldwin: A Love Story', author: 'Nicholas Boggs', year: 2025 })

  it('matches the title or author regardless of case', () => {
    expect(matchesFilters(baldwin, filters({ search: 'BALDWIN' }))).toBe(true)
    expect(matchesFilters(baldwin, filters({ search: 'boggs' }))).toBe(true)
  })

  it('matches a partial word', () => {
    expect(matchesFilters(baldwin, filters({ search: 'bald' }))).toBe(true)
  })

  it('requires every word, across title and author', () => {
    expect(matchesFilters(baldwin, filters({ search: 'love boggs' }))).toBe(true)
    expect(matchesFilters(baldwin, filters({ search: 'love zebra' }))).toBe(false)
  })

  it('ignores accents in both the search and the book', () => {
    const hacienda = book({ title: 'The Hacienda', author: 'Isabel Cañas' })

    expect(matchesFilters(hacienda, filters({ search: 'canas' }))).toBe(true)
    expect(matchesFilters(book({ author: 'Isabel Canas' }), filters({ search: 'Cañas' }))).toBe(true)
  })

  it('treats a blank search as no search', () => {
    expect(matchesFilters(baldwin, filters({ search: '   ' }))).toBe(true)
  })

  it('looks across all years, ignoring the year selection', () => {
    expect(matchesFilters(baldwin, filters({ years: [2013], search: 'baldwin' }))).toBe(true)
  })

  it('still applies the tag and status filters', () => {
    expect(matchesFilters(book({ ...baldwin, status: 'dismissed' }), filters({ search: 'baldwin' }))).toBe(false)
    expect(matchesFilters(baldwin, filters({ tags: ['poetry'], search: 'baldwin' }))).toBe(false)
  })
})

describe('toggleStatusFilter', () => {
  it('adds a status that is not selected', () => {
    expect(toggleStatusFilter(['unmarked', 'read'], 'dismissed')).toEqual(['unmarked', 'read', 'dismissed'])
  })

  it('removes a selected status', () => {
    expect(toggleStatusFilter(['unmarked', 'read'], 'read')).toEqual(['unmarked'])
  })

  it('keeps the last selected status, since an empty selection would show nothing useful', () => {
    expect(toggleStatusFilter(['read'], 'read')).toEqual(['read'])
  })

  it('treats an empty selection as every status', () => {
    expect(toggleStatusFilter([], 'dismissed')).toEqual(['unmarked', 'want_to_read', 'read'])
  })
})

describe('isStatusIncluded', () => {
  it('is true for a selected status and false otherwise', () => {
    expect(isStatusIncluded(['read'], 'read')).toBe(true)
    expect(isStatusIncluded(['read'], 'unmarked')).toBe(false)
  })

  it('includes every status when none is selected', () => {
    expect(isStatusIncluded([], 'dismissed')).toBe(true)
  })
})

describe('filterBooks', () => {
  it('keeps matching books in their original order', () => {
    const books = [book({ title: 'C', year: 2024 }), book({ title: 'A', year: 2023 }), book({ title: 'B', year: 2024 })]

    expect(filterBooks(books, filters({ years: [2024] })).map((b) => b.title)).toEqual(['C', 'B'])
  })
})
