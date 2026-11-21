// ABOUTME: Tests for how a book's status changes when the reader marks it or edits read details.
// ABOUTME: Covers toggling, clearing read details when leaving Read, and validating dates and ratings.

import type { BookStatus, StatusRecord } from '../types/catalog.ts'
import { toggleStatus, updateReadDetails } from './statusTransitions.ts'

function record(status: BookStatus, details: Partial<StatusRecord> = {}): StatusRecord {
  return { status, dateRead: null, ratingQuarters: null, ...details }
}

describe('toggleStatus', () => {
  it.each<BookStatus>(['want_to_read', 'read', 'dismissed'])('marks an unmarked book as %s', (target) => {
    expect(toggleStatus(null, target)).toEqual({
      change: { kind: 'save', record: record(target) },
      losesReadDetails: false,
    })
  })

  it('switches from one status to another', () => {
    expect(toggleStatus(record('want_to_read'), 'read')).toEqual({
      change: { kind: 'save', record: record('read') },
      losesReadDetails: false,
    })
  })

  it.each<BookStatus>(['want_to_read', 'read', 'dismissed'])('unmarks a %s book when its status is chosen again', (status) => {
    expect(toggleStatus(record(status), status)).toEqual({ change: { kind: 'remove' }, losesReadDetails: false })
  })

  it('clears the date and rating when leaving Read, and says so', () => {
    expect(toggleStatus(record('read', { dateRead: '2025-06-14', ratingQuarters: 15 }), 'dismissed')).toEqual({
      change: { kind: 'save', record: record('dismissed') },
      losesReadDetails: true,
    })
  })

  it.each([
    ['a date', { dateRead: '2025-06-14' }],
    ['a rating', { ratingQuarters: 0 }],
  ])('reports lost details when a read book with only %s is unmarked', (_label, details) => {
    expect(toggleStatus(record('read', details), 'read')).toEqual({ change: { kind: 'remove' }, losesReadDetails: true })
  })

  it('reports nothing lost when leaving a read book with no details', () => {
    expect(toggleStatus(record('read'), 'want_to_read').losesReadDetails).toBe(false)
  })
})

describe('updateReadDetails', () => {
  it('sets the date read', () => {
    expect(updateReadDetails(record('read'), { dateRead: '2025-06-14' })).toEqual(record('read', { dateRead: '2025-06-14' }))
  })

  it('sets the rating, keeping the date', () => {
    expect(updateReadDetails(record('read', { dateRead: '2025-06-14' }), { ratingQuarters: 15 })).toEqual(
      record('read', { dateRead: '2025-06-14', ratingQuarters: 15 }),
    )
  })

  it('clears a detail set to null', () => {
    expect(updateReadDetails(record('read', { dateRead: '2025-06-14', ratingQuarters: 15 }), { ratingQuarters: null })).toEqual(
      record('read', { dateRead: '2025-06-14' }),
    )
  })

  it.each([-1, 21, 2.5])('rejects rating %d', (ratingQuarters) => {
    expect(() => updateReadDetails(record('read'), { ratingQuarters })).toThrow(
      `Rating must be a whole number of quarter stars from 0 to 20, got ${ratingQuarters}`,
    )
  })

  it.each(['2025-02-30', '2025-6-14', 'June 14, 2025', ''])('rejects the date %j', (dateRead) => {
    expect(() => updateReadDetails(record('read'), { dateRead })).toThrow(
      `Date read must be a real date in YYYY-MM-DD form, got "${dateRead}"`,
    )
  })

  it.each<BookStatus>(['want_to_read', 'dismissed'])('refuses to add read details to a %s book', (status) => {
    expect(() => updateReadDetails(record(status), { ratingQuarters: 4 })).toThrow(
      'Read details can only be set on a book marked read',
    )
  })
})
