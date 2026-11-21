// ABOUTME: Puts books in browse order: newest year first, then title alphabetically.
// ABOUTME: Returns a new array; the input is left unchanged.

import type { CatalogItem } from '../types/catalog.ts'

const titleCollator = new Intl.Collator(undefined, { sensitivity: 'base' })

export function sortBooks<T extends Pick<CatalogItem, 'year' | 'title'>>(books: T[]): T[] {
  return [...books].sort((a, b) => b.year - a.year || titleCollator.compare(a.title, b.title))
}
