// ABOUTME: Tests for the short status text shown on each book.
// ABOUTME: Read books include their rating when they have one.

import { statusBadgeText } from './statusLabels.ts'

describe('statusBadgeText', () => {
  it.each([
    [{ status: 'want_to_read', dateRead: null, ratingQuarters: null }, 'Want to read'],
    [{ status: 'dismissed', dateRead: null, ratingQuarters: null }, 'Dismissed'],
    [{ status: 'read', dateRead: null, ratingQuarters: null }, 'Read'],
    [{ status: 'read', dateRead: '2025-06-14', ratingQuarters: 15 }, 'Read · ★ 3.75'],
    [{ status: 'read', dateRead: null, ratingQuarters: 0 }, 'Read · ★ 0'],
  ] as const)('describes %j as "%s"', (record, text) => {
    expect(statusBadgeText(record)).toBe(text)
  })
})
