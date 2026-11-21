// ABOUTME: Loads one list entry's blurb, reviewers, and links when its detail panel opens.
// ABOUTME: Cached for the session, since catalog details rarely change.

import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchEntryDetail } from '../data/catalog.ts'
import { useSupabase } from '../data/supabaseContext.ts'

export function useEntryDetail(entryId: string) {
  const client = useSupabase()
  const query = useQuery({
    queryKey: ['entryDetail', entryId],
    queryFn: () => fetchEntryDetail(client, entryId),
    staleTime: Infinity,
  })

  useEffect(() => {
    if (query.error) console.error('Could not load book details', query.error)
  }, [query.error])

  return query
}
