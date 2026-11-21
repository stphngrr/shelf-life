// ABOUTME: Short label showing a book's status, and its rating when the book is read and rated.
// ABOUTME: Renders nothing for an unmarked book.

import { statusBadgeText } from '../lib/statusLabels.ts'
import type { StatusRecord } from '../types/catalog.ts'

export function StatusBadge({ status }: { status: StatusRecord | null }) {
  if (!status) return null
  return (
    <p data-testid="status-badge" className="text-xs font-medium text-gray-800">
      {statusBadgeText(status)}
    </p>
  )
}
