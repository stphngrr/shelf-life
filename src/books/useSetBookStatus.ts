// ABOUTME: Saves a change to a book's status, showing it immediately and undoing it if the save fails.
// ABOUTME: A failed save rolls back only its own book, so other changes made meanwhile survive.

import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { applyStatusChange } from '../data/statuses.ts'
import { useSupabase } from '../data/supabaseContext.ts'
import { describeRequestError } from '../lib/backendMessages.ts'
import type { StatusChange } from '../lib/statusTransitions.ts'
import type { StatusRecord } from '../types/catalog.ts'
import { statusesQueryKey } from './useBooks.ts'

type Statuses = Map<string, StatusRecord>

interface Variables {
  bookId: string
  change: StatusChange
}

function withBookStatus(statuses: Statuses | undefined, bookId: string, record: StatusRecord | null): Statuses {
  const next = new Map(statuses)
  if (record) next.set(bookId, record)
  else next.delete(bookId)
  return next
}

export function useSetBookStatus(userId: string) {
  const client = useSupabase()
  const queryClient = useQueryClient()
  const queryKey = statusesQueryKey(userId)
  const mutationKey = ['setStatus', userId]
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const mutation = useMutation({
    mutationKey,
    mutationFn: ({ bookId, change }: Variables) => applyStatusChange(client, userId, bookId, change),
    onMutate: async ({ bookId, change }: Variables) => {
      // Keep an in-flight load from overwriting the optimistic change.
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Statuses>(queryKey)?.get(bookId) ?? null
      const next = change.kind === 'save' ? change.record : null
      queryClient.setQueryData<Statuses>(queryKey, (statuses) => withBookStatus(statuses, bookId, next))
      return { previous }
    },
    onError: (error, { bookId }, context) => {
      console.error('Could not save status', error)
      queryClient.setQueryData<Statuses>(queryKey, (statuses) => withBookStatus(statuses, bookId, context?.previous ?? null))
      setErrorMessage(describeRequestError(error, 'save your change'))
    },
  })

  const saving = useIsMutating({ mutationKey }) > 0

  return {
    setStatus: (bookId: string, change: StatusChange) => {
      setErrorMessage(null)
      mutation.mutate({ bookId, change })
    },
    saving,
    errorMessage,
    dismissError: () => setErrorMessage(null),
  }
}
