// ABOUTME: Tests for remembering whether the reader prefers the grid or list view on this device.
// ABOUTME: Covers the default, saving, bad saved values, and browsers that block storage.

import { act, renderHook } from '@testing-library/react'
import { useViewMode, VIEW_MODE_STORAGE_KEY } from './useViewMode.ts'

describe('useViewMode', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts in the grid view', () => {
    const { result } = renderHook(() => useViewMode())

    expect(result.current[0]).toBe('grid')
  })

  it('remembers a change for next time', () => {
    const first = renderHook(() => useViewMode())
    act(() => first.result.current[1]('list'))
    first.unmount()

    const second = renderHook(() => useViewMode())

    expect(second.result.current[0]).toBe('list')
    expect(localStorage.getItem(VIEW_MODE_STORAGE_KEY)).toBe('list')
  })

  it('ignores a saved value it does not recognize', () => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, 'carousel')

    const { result } = renderHook(() => useViewMode())

    expect(result.current[0]).toBe('grid')
  })

  it('still works, in the grid view, when the browser blocks storage', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    const { result } = renderHook(() => useViewMode())
    act(() => result.current[1]('list'))

    expect(result.current[0]).toBe('list')
    expect(warn).toHaveBeenCalledWith('Could not read the saved view mode', expect.any(DOMException))
    expect(warn).toHaveBeenCalledWith('Could not save the view mode', expect.any(DOMException))
  })
})
