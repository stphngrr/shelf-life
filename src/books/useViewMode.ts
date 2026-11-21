// ABOUTME: Remembers whether the reader prefers the grid or list view on this device.
// ABOUTME: Falls back to the grid, with a warning, when the browser blocks local storage.

import { useState } from 'react'

export type ViewMode = 'grid' | 'list'

export const VIEW_MODE_STORAGE_KEY = 'shelf-life:view-mode'

function readSavedViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'list' ? 'list' : 'grid'
  } catch (error) {
    console.warn('Could not read the saved view mode', error)
    return 'grid'
  }
}

function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
  } catch (error) {
    console.warn('Could not save the view mode', error)
  }
}

export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState(readSavedViewMode)
  return [
    mode,
    (next: ViewMode) => {
      setMode(next)
      saveViewMode(next)
    },
  ]
}
