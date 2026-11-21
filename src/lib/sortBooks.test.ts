// ABOUTME: Tests for the browse order: newest year first, then title alphabetically.
// ABOUTME: Sorting must not change the array it is given.

import { sortBooks } from './sortBooks.ts'

describe('sortBooks', () => {
  it('puts newer years first, and orders titles alphabetically within a year', () => {
    const books = [
      { year: 2023, title: 'Middle' },
      { year: 2025, title: 'zebra' },
      { year: 2025, title: 'Apple' },
      { year: 2013, title: 'Oldest' },
    ]

    expect(sortBooks(books)).toEqual([
      { year: 2025, title: 'Apple' },
      { year: 2025, title: 'zebra' },
      { year: 2023, title: 'Middle' },
      { year: 2013, title: 'Oldest' },
    ])
  })

  it('leaves the original array in place', () => {
    const books = [
      { year: 2013, title: 'B' },
      { year: 2025, title: 'A' },
    ]

    sortBooks(books)

    expect(books.map((b) => b.year)).toEqual([2013, 2025])
  })
})
