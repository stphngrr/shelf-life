// ABOUTME: Tests for turning Supabase API results into data or meaningful errors.
// ABOUTME: Distinguishes a paused or unreachable backend from ordinary query errors.

import { PostgrestError } from '@supabase/supabase-js'
import { BackendUnavailableError, unwrapResponse } from './response.ts'

const queryError = new PostgrestError({ message: 'boom', details: '', hint: '', code: '23514' })
const gatewayError = new PostgrestError({ message: 'gateway', details: '', hint: '', code: '' })

function caught(fn: () => unknown): unknown {
  try {
    fn()
  } catch (error) {
    return error
  }
  throw new Error('expected a throw')
}

describe('unwrapResponse', () => {
  it('returns the data of a successful response', () => {
    expect(unwrapResponse({ data: [1, 2], error: null, status: 200 })).toEqual([1, 2])
  })

  it('reports a paused project for status 540', () => {
    const error = caught(() => unwrapResponse({ data: null, error: gatewayError, status: 540 }))

    expect(error).toBeInstanceOf(BackendUnavailableError)
    expect(error).toMatchObject({ reason: 'paused', message: 'The Supabase project is paused' })
  })

  it.each([0, 502, 503, 504])('reports an unreachable backend for status %i', (status) => {
    const error = caught(() => unwrapResponse({ data: null, error: gatewayError, status }))

    expect(error).toBeInstanceOf(BackendUnavailableError)
    expect(error).toMatchObject({ reason: 'unreachable', message: `The Supabase backend is unreachable (status ${status})` })
  })

  it('throws an ordinary query error unchanged', () => {
    const error = caught(() => unwrapResponse({ data: null, error: queryError, status: 400 }))

    expect(error).toBe(queryError)
  })
})
