// ABOUTME: Reader-facing names for each book status and status filter.
// ABOUTME: Shared by the filter bar, status badges, and marking buttons so they always agree.

import type { StatusFilter } from './filters.ts'

export const STATUS_LABELS: Record<StatusFilter, string> = {
  unmarked: 'Unmarked',
  want_to_read: 'Want to read',
  read: 'Read',
  dismissed: 'Dismissed',
}
