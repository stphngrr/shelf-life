// ABOUTME: Keeps the browse filters in the URL hash so views can be bookmarked and revisited with back/forward.
// ABOUTME: Filter changes add a history entry by default; typing in search can replace the current one.

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { Filters } from '../lib/filters.ts'
import { filtersFromHash, filtersToHash } from '../lib/urlState.ts'

// history.pushState and replaceState don't fire events, so changes made here announce themselves.
const LOCATION_CHANGED = 'shelf-life:location-changed'
const EVENTS = ['popstate', 'hashchange', LOCATION_CHANGED]

function subscribe(onChange: () => void): () => void {
  for (const event of EVENTS) window.addEventListener(event, onChange)
  return () => {
    for (const event of EVENTS) window.removeEventListener(event, onChange)
  }
}

function currentHash(): string {
  return window.location.hash
}

export interface FilterUpdateOptions {
  /** Replace the current history entry instead of adding one, e.g. while typing a search. */
  replace?: boolean
}

export function useFilters(): [Filters, (next: Filters, options?: FilterUpdateOptions) => void] {
  const hash = useSyncExternalStore(subscribe, currentHash)
  const filters = useMemo(() => filtersFromHash(hash), [hash])

  const setFilters = useCallback((next: Filters, { replace = false }: FilterUpdateOptions = {}) => {
    const nextHash = filtersToHash(next)
    if (nextHash === window.location.hash) return
    const { pathname, search } = window.location
    const url = `${pathname}${search}${nextHash}`
    if (replace) window.history.replaceState(window.history.state, '', url)
    else window.history.pushState(window.history.state, '', url)
    window.dispatchEvent(new Event(LOCATION_CHANGED))
  }, [])

  return [filters, setFilters]
}
