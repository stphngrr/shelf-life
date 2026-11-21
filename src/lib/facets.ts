// ABOUTME: Lists the years and tags that appear in the catalog, for the filter bar's choices.
// ABOUTME: Years run newest first; tags alphabetically.

import type { CatalogItem } from '../types/catalog.ts'

export interface CatalogFacets {
  years: number[]
  tags: string[]
}

export function catalogFacets(books: Pick<CatalogItem, 'year' | 'tags'>[]): CatalogFacets {
  const years = new Set<number>()
  const tags = new Set<string>()
  for (const book of books) {
    years.add(book.year)
    for (const tag of book.tags) tags.add(tag)
  }
  return {
    years: [...years].sort((a, b) => b - a),
    tags: [...tags].sort((a, b) => a.localeCompare(b)),
  }
}
