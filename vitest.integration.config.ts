// ABOUTME: Vitest configuration for integration tests against local Supabase.
// ABOUTME: Loads env from .env files and runs test files serially against the shared database.

import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    fileParallelism: false,
  },
}))
