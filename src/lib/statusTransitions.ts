// ABOUTME: Rules for changing a book's status: marking, unmarking, and editing read details.
// ABOUTME: Mirrors the database rule that only read books carry a date read and a rating.

import type { BookStatus, StatusRecord } from '../types/catalog.ts'
import { isValidRatingQuarters } from './rating.ts'

/** What to store for the book: a status row to save, or removal of its row (unmarked). */
export type StatusChange = { kind: 'save'; record: StatusRecord } | { kind: 'remove' }

export interface StatusTransition {
  change: StatusChange
  /** True when the change discards a date read or rating, so the reader should confirm first. */
  losesReadDetails: boolean
}

export interface ReadDetails {
  dateRead?: string | null
  ratingQuarters?: number | null
}

function hasReadDetails(record: StatusRecord | null): boolean {
  return record !== null && (record.dateRead !== null || record.ratingQuarters !== null)
}

/** Choosing a book's current status again unmarks it; choosing another status replaces it. */
export function toggleStatus(current: StatusRecord | null, target: BookStatus): StatusTransition {
  const change: StatusChange =
    current?.status === target
      ? { kind: 'remove' }
      : { kind: 'save', record: { status: target, dateRead: null, ratingQuarters: null } }
  return { change, losesReadDetails: hasReadDetails(current) }
}

function isRealIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/** Applies a date read and/or rating to a read book; omitted details are kept, null clears one. */
export function updateReadDetails(current: StatusRecord, details: ReadDetails): StatusRecord {
  if (current.status !== 'read') throw new Error('Read details can only be set on a book marked read')

  const { dateRead, ratingQuarters } = details
  if (typeof dateRead === 'string' && !isRealIsoDate(dateRead)) {
    throw new RangeError(`Date read must be a real date in YYYY-MM-DD form, got "${dateRead}"`)
  }
  if (typeof ratingQuarters === 'number' && !isValidRatingQuarters(ratingQuarters)) {
    throw new RangeError(`Rating must be a whole number of quarter stars from 0 to 20, got ${ratingQuarters}`)
  }

  return {
    ...current,
    ...(dateRead !== undefined && { dateRead }),
    ...(ratingQuarters !== undefined && { ratingQuarters }),
  }
}
