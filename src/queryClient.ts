// ABOUTME: Builds the application's TanStack Query client.
// ABOUTME: Uses networkMode 'always' so requests fail visibly instead of pausing when the browser reports offline.

import { QueryClient, type DefaultOptions } from '@tanstack/react-query'

// `overrides` lets tests run through this same factory so they exercise the real
// configuration rather than a bare QueryClient.
export function createQueryClient(overrides?: DefaultOptions): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // No query retries: supabase-js already retries reads that fail in transit, and a
      // paused project won't recover on retry, so the reader should hear about it at once.
      queries: { networkMode: 'always', retry: false, ...overrides?.queries },
      mutations: { networkMode: 'always', ...overrides?.mutations },
    },
  })
}
