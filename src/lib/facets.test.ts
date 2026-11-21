// ABOUTME: Tests for listing the years and tags available to filter by.
// ABOUTME: Years run newest first; tags alphabetically; each appears once.

import { catalogFacets } from './facets.ts'

describe('catalogFacets', () => {
  it('lists each year once, newest first, and each tag once, alphabetically', () => {
    const books = [
      { year: 2023, tags: ['fiction', 'mysteries & thrillers'] },
      { year: 2025, tags: ['kids’ books'] },
      { year: 2023, tags: ['fiction', 'biography & memoir'] },
    ]

    expect(catalogFacets(books)).toEqual({
      years: [2025, 2023],
      tags: ['biography & memoir', 'fiction', 'kids’ books', 'mysteries & thrillers'],
    })
  })

  it('is empty for an empty catalog', () => {
    expect(catalogFacets([])).toEqual({ years: [], tags: [] })
  })
})
