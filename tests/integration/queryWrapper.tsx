// ABOUTME: Wraps hooks and components under test in the app's real Supabase and query providers.
// ABOUTME: Uses the production query client factory so tests exercise the real configuration.

import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SupabaseProvider } from '../../src/data/SupabaseProvider.tsx'
import type { AppSupabaseClient } from '../../src/data/supabaseClient.ts'
import { createQueryClient } from '../../src/queryClient.ts'

export function createAppWrapper(client: AppSupabaseClient) {
  const queryClient = createQueryClient()

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SupabaseProvider client={client}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </SupabaseProvider>
    )
  }

  return { wrapper: Wrapper, queryClient }
}
