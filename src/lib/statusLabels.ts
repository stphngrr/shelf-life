// ABOUTME: Reader-facing names for each book status and status filter.
// ABOUTME: Shared by the filter bar, status badges, and marking buttons so they always agree.

import type { StatusRecord } from '../types/catalog.ts'
import type { StatusFilter } from './filters.ts'
import { formatStars } from './rating.ts'

export const STATUS_LABELS: Record<StatusFilter, string> = {
  unmarked: 'Unmarked',
  want_to_read: 'Want to read',
  read: 'Read',
  dismissed: 'Dismissed',
}

/** Short text for a book's status, including the rating of a rated read book. */
export function statusBadgeText(record: StatusRecord): string {
  const label = STATUS_LABELS[record.status]
  return record.ratingQuarters === null ? label : `${label} · ★ ${formatStars(record.ratingQuarters)}`
}
