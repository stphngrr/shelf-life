// ABOUTME: Integration tests for how the data layer reports a paused or unreachable Supabase backend.
// ABOUTME: Uses real supabase-js clients aimed at a closed port and at a local server answering 540.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fetchCatalog, fetchEntryDetail } from '../../src/data/catalog.ts'
import { BackendUnavailableError } from '../../src/data/response.ts'
import { applyStatusChange, fetchStatuses } from '../../src/data/statuses.ts'
import type { Database } from '../../src/types/database.ts'

// supabase-js retries failed reads three times with backoff (about 7 seconds in all). Most tests
// turn retries off to stay fast; one keeps the default to cover what the app actually does.
function clientFor(url: string, { retry = false } = {}): SupabaseClient<Database> {
  return createClient<Database>(url, 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { retry },
  })
}

const operations: [string, (client: SupabaseClient<Database>) => Promise<unknown>][] = [
  ['fetchCatalog', (client) => fetchCatalog(client)],
  ['fetchEntryDetail', (client) => fetchEntryDetail(client, crypto.randomUUID())],
  ['fetchStatuses', (client) => fetchStatuses(client)],
  [
    'applyStatusChange (save)',
    (client) =>
      applyStatusChange(client, crypto.randomUUID(), crypto.randomUUID(), {
        kind: 'save',
        record: { status: 'read', dateRead: null, ratingQuarters: null },
      }),
  ],
  ['applyStatusChange (remove)', (client) => applyStatusChange(client, crypto.randomUUID(), crypto.randomUUID(), { kind: 'remove' })],
]

describe('backend availability', () => {
  let pausedServer: Server
  let pausedUrl: string
  let closedUrl: string

  beforeAll(async () => {
    pausedServer = createServer((_request, response) => {
      response.writeHead(540, { 'content-type': 'text/plain' }).end('Project paused')
    })
    await new Promise<void>((resolve) => pausedServer.listen(0, '127.0.0.1', resolve))
    pausedUrl = `http://127.0.0.1:${(pausedServer.address() as AddressInfo).port}`

    const closed = createServer()
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve))
    closedUrl = `http://127.0.0.1:${(closed.address() as AddressInfo).port}`
    await new Promise((resolve) => closed.close(resolve))
  })

  afterAll(async () => {
    await new Promise((resolve) => pausedServer.close(resolve))
  })

  it.each(operations)('%s reports a paused project', async (_name, operation) => {
    const error = await operation(clientFor(pausedUrl)).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(BackendUnavailableError)
    expect(error).toMatchObject({ reason: 'paused' })
  })

  it.each(operations)('%s reports an unreachable backend', async (_name, operation) => {
    const error = await operation(clientFor(closedUrl)).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(BackendUnavailableError)
    expect(error).toMatchObject({ reason: 'unreachable' })
  })

  it('reports an unreachable backend after the client’s default retries', { timeout: 15_000 }, async () => {
    const error = await fetchStatuses(clientFor(closedUrl, { retry: true })).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(BackendUnavailableError)
    expect(error).toMatchObject({ reason: 'unreachable' })
  })
})
