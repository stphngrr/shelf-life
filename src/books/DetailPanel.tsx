// ABOUTME: Dialog showing one book's full details, loaded when it opens.
// ABOUTME: A side panel on wide screens and full screen on phones; closes with its button or Escape.

import { useEffect, useRef } from 'react'
import { describeRequestError } from '../lib/backendMessages.ts'
import type { ReadDetails } from '../lib/statusTransitions.ts'
import type { BookStatus } from '../types/catalog.ts'
import { BookDetails } from './BookDetails.tsx'
import type { BrowseBook } from './useBooks.ts'
import { useEntryDetail } from './useEntryDetail.ts'

interface DetailPanelProps {
  book: BrowseBook
  onClose: () => void
  onToggleStatus: (book: BrowseBook, status: BookStatus) => void
  onUpdateReadDetails: (book: BrowseBook, details: ReadDetails) => void
}

export function DetailPanel({ book, onClose, onToggleStatus, onUpdateReadDetails }: DetailPanelProps) {
  const detail = useEntryDetail(book.entryId)
  const closeButton = useRef<HTMLButtonElement>(null)

  // Move focus into the panel, and give it back to whatever opened the panel when it closes.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeButton.current?.focus()
    return () => opener?.focus()
  }, [])

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-10 flex justify-end bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={book.title}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col gap-4 overflow-y-auto bg-white p-4 shadow-xl md:max-w-lg"
      >
        <div className="flex justify-end">
          <button ref={closeButton} type="button" onClick={onClose} className="text-sm text-gray-700 underline">
            Close
          </button>
        </div>
        {detail.data ? (
          <BookDetails
            book={book}
            detail={detail.data}
            onToggleStatus={onToggleStatus}
            onUpdateReadDetails={onUpdateReadDetails}
          />
        ) : detail.error ? (
          <p role="alert" className="text-red-700">
            {describeRequestError(detail.error, 'load the details')}
          </p>
        ) : (
          <p className="text-gray-600">Loading details…</p>
        )}
      </div>
    </div>
  )
}
