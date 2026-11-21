// ABOUTME: Tests for storing browse filters in the URL hash and reading them back.
// ABOUTME: Covers defaults, round trips with awkward tag names, canonical ordering, and bad input.

import { DEFAULT_FILTERS, type Filters } from './filters.ts'
import { filtersFromHash, filtersToHash } from './urlState.ts'

function filters(overrides: Partial<Filters> = {}): Filters {
  return { ...DEFAULT_FILTERS, ...overrides }
}

describe('filtersToHash', () => {
  it('is empty for the default filters', () => {
    expect(filtersToHash(DEFAULT_FILTERS)).toBe('')
  })

  it('writes years, tags, status, and search in a fixed order', () => {
    expect(
      filtersToHash({ years: [2024, 2023], tags: ['fiction'], statuses: ['read'], search: 'baldwin' }),
    ).toBe('#years=2023%7C2024&tags=fiction&status=read&q=baldwin')
  })

  it('omits a blank search', () => {
    expect(filtersToHash(filters({ search: '  ' }))).toBe('')
  })

  it('writes an empty status list, which means every status', () => {
    expect(filtersToHash(filters({ statuses: [] }))).toBe('#status=')
  })

  it('writes the same hash regardless of selection order or duplicates', () => {
    const a = filters({ years: [2025, 2023, 2025], tags: ['b', 'a'], statuses: ['read', 'unmarked'] })
    const b = filters({ years: [2023, 2025], tags: ['a', 'b'], statuses: ['unmarked', 'read'] })

    expect(filtersToHash(a)).toBe(filtersToHash(b))
  })
})

describe('filtersFromHash', () => {
  it.each(['', '#'])('returns the default filters for %j', (hash) => {
    expect(filtersFromHash(hash)).toEqual(DEFAULT_FILTERS)
  })

  it('round-trips tags containing commas, ampersands, and curly apostrophes', () => {
    const original = filters({
      years: [2013, 2025],
      tags: ['kids’ books', 'sci fi, fantasy & speculative fiction'],
      statuses: ['unmarked', 'dismissed'],
      search: 'love & war',
    })

    expect(filtersFromHash(filtersToHash(original))).toEqual(original)
  })

  it('round-trips an empty status list', () => {
    expect(filtersFromHash(filtersToHash(filters({ statuses: [] })))).toEqual(filters({ statuses: [] }))
  })

  it('accepts a hash without the leading #', () => {
    expect(filtersFromHash('years=2024').years).toEqual([2024])
  })

  it('ignores years that are not whole numbers', () => {
    expect(filtersFromHash('#years=2024%7C20x4%7C2023.5%7C').years).toEqual([2024])
  })

  it('ignores unknown statuses', () => {
    expect(filtersFromHash('#status=read%7Cfinished').statuses).toEqual(['read'])
  })

  it('ignores empty tags and unknown parameters', () => {
    expect(filtersFromHash('#tags=%7Cfiction%7C&view=grid')).toEqual(filters({ tags: ['fiction'] }))
  })
})
