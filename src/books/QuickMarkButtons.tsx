// ABOUTME: One-tap buttons to mark a book want to read, read, or dismissed.
// ABOUTME: The active status's button is shown pressed; pressing it again unmarks the book.

import type { BookStatus } from '../types/catalog.ts'

const QUICK_MARKS: { status: BookStatus; label: string }[] = [
  { status: 'want_to_read', label: 'Want' },
  { status: 'read', label: 'Read' },
  { status: 'dismissed', label: 'Dismiss' },
]

export function QuickMarkButtons({
  current,
  onToggle,
}: {
  current: BookStatus | null
  onToggle: (status: BookStatus) => void
}) {
  return (
    <div className="flex gap-1">
      {QUICK_MARKS.map(({ status, label }) => {
        const pressed = current === status
        return (
          <button
            key={status}
            type="button"
            aria-pressed={pressed}
            onClick={() => onToggle(status)}
            className={`flex-1 rounded border px-2 py-1 text-xs font-medium ${
              pressed ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-500'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
