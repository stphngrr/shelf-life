// ABOUTME: Global test setup for Vitest.
// ABOUTME: Registers jest-dom matchers and fails any test that logs an error or warning it didn't expect.

import '@testing-library/jest-dom/vitest'

// Vitest's default reporter hides console output from passing tests, so unexpected errors and
// warnings would go unseen. Record them and fail the test instead. A test that expects one
// spies on console itself (vi.spyOn(console, 'error')), which replaces this recording.
let unexpectedLogs: string[] = []

beforeEach(() => {
  unexpectedLogs = []
  for (const level of ['error', 'warn'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      unexpectedLogs.push(`console.${level}: ${args.map(String).join(' ')}`)
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  if (unexpectedLogs.length > 0) {
    throw new Error(`Test logged unexpected output:\n${unexpectedLogs.join('\n')}`)
  }
})
