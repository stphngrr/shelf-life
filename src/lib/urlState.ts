// ABOUTME: Stores the browse filters in the URL hash so views can be bookmarked and navigated back to.
// ABOUTME: Lists are "|"-separated because NPR tag names contain commas and ampersands.

import { DEFAULT_FILTERS, STATUS_FILTERS, type Filters, type StatusFilter } from './filters.ts'

const LIST_SEPARATOR = '|'

function joinList(values: (string | number)[]): string {
  return values.join(LIST_SEPARATOR)
}

function splitList(value: string): string[] {
  return value.split(LIST_SEPARATOR).filter((item) => item !== '')
}

function canonicalStatuses(statuses: StatusFilter[]): StatusFilter[] {
  return STATUS_FILTERS.filter((status) => statuses.includes(status))
}

function isDefaultStatuses(statuses: StatusFilter[]): boolean {
  return joinList(canonicalStatuses(statuses)) === joinList(DEFAULT_FILTERS.statuses)
}

/** The hash for these filters, including the leading "#", or "" for the default filters. */
export function filtersToHash(filters: Filters): string {
  const params = new URLSearchParams()
  if (filters.years.length > 0) {
    params.set('years', joinList([...new Set(filters.years)].sort((a, b) => a - b)))
  }
  if (filters.tags.length > 0) {
    params.set('tags', joinList([...new Set(filters.tags)].sort()))
  }
  if (!isDefaultStatuses(filters.statuses)) {
    params.set('status', joinList(canonicalStatuses(filters.statuses)))
  }
  if (filters.search.trim() !== '') {
    params.set('q', filters.search)
  }
  const query = params.toString()
  return query ? `#${query}` : ''
}

/** Reads filters from a URL hash, falling back to defaults and ignoring anything malformed. */
export function filtersFromHash(hash: string): Filters {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const years = params.get('years')
  const tags = params.get('tags')
  const status = params.get('status')

  return {
    years: years === null ? DEFAULT_FILTERS.years : splitList(years).filter((y) => /^\d+$/.test(y)).map(Number),
    tags: tags === null ? DEFAULT_FILTERS.tags : splitList(tags),
    statuses:
      status === null
        ? DEFAULT_FILTERS.statuses
        : canonicalStatuses(splitList(status).filter((s): s is StatusFilter => STATUS_FILTERS.includes(s as StatusFilter))),
    search: params.get('q') ?? DEFAULT_FILTERS.search,
  }
}
