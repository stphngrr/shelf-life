// ABOUTME: Vitest configuration for integration tests against local Supabase.
// ABOUTME: Loads env from .env files and runs test files serially against the shared database.

import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  test: {
    globals: true,
    // Tests that render components opt into jsdom with a `@vitest-environment jsdom` comment.
    environment: 'node',
    include: ['tests/integration/**/*.test.{ts,tsx}'],
    setupFiles: './src/test/setup.ts',
    env: loadEnv(mode, process.cwd(), ''),
    fileParallelism: false,
  },
}))
