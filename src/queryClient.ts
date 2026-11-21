// ABOUTME: Builds the application's TanStack Query client.
// ABOUTME: Uses networkMode 'always' so requests fail visibly instead of pausing when the browser reports offline.

import { QueryClient, type DefaultOptions } from '@tanstack/react-query'

// `overrides` lets tests run through this same factory (e.g. retry: false) so they
// exercise the real configuration rather than a bare QueryClient.
export function createQueryClient(overrides?: DefaultOptions): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: 'always', ...overrides?.queries },
      mutations: { networkMode: 'always', ...overrides?.mutations },
    },
  })
}
