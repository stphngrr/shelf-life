// ABOUTME: Tests for keeping the browse filters in the URL hash and browser history.
// ABOUTME: Uses jsdom's real location and history objects.

import { act, renderHook, waitFor } from '@testing-library/react'
import { DEFAULT_FILTERS, type Filters } from '../lib/filters.ts'
import { useFilters } from './useFilters.ts'

function filters(overrides: Partial<Filters>): Filters {
  return { ...DEFAULT_FILTERS, ...overrides }
}

describe('useFilters', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('starts from the filters in the URL hash', () => {
    window.history.replaceState(null, '', '/#years=2024&tags=fiction')

    const { result } = renderHook(() => useFilters())

    expect(result.current[0]).toEqual(filters({ years: [2024], tags: ['fiction'] }))
  })

  it('starts from the default filters when there is no hash', () => {
    const { result } = renderHook(() => useFilters())

    expect(result.current[0]).toEqual(DEFAULT_FILTERS)
  })

  it('writes a change to the hash as a new history entry', () => {
    const { result } = renderHook(() => useFilters())
    const lengthBefore = window.history.length

    act(() => result.current[1](filters({ years: [2023] })))

    expect(result.current[0]).toEqual(filters({ years: [2023] }))
    expect(window.location.hash).toBe('#years=2023')
    expect(window.history.length).toBe(lengthBefore + 1)
  })

  it('can replace the current history entry instead', () => {
    const { result } = renderHook(() => useFilters())
    const lengthBefore = window.history.length

    act(() => result.current[1](filters({ search: 'baldwin' }), { replace: true }))

    expect(window.location.hash).toBe('#q=baldwin')
    expect(window.history.length).toBe(lengthBefore)
  })

  it('removes the hash entirely for the default filters', () => {
    window.history.replaceState(null, '', '/?keep=1#years=2024')
    const { result } = renderHook(() => useFilters())

    act(() => result.current[1](DEFAULT_FILTERS))

    expect(window.location.href).toBe(`${window.location.origin}/?keep=1`)
  })

  it('follows the back button to the previous filters', async () => {
    const { result } = renderHook(() => useFilters())
    act(() => result.current[1](filters({ years: [2023] })))

    act(() => window.history.back())

    await waitFor(() => expect(result.current[0]).toEqual(DEFAULT_FILTERS))
  })

  it('follows a hash changed from outside, such as an edited URL', async () => {
    const { result } = renderHook(() => useFilters())

    act(() => {
      window.location.hash = '#status=read'
    })

    await waitFor(() => expect(result.current[0]).toEqual(filters({ statuses: ['read'] })))
  })
})
