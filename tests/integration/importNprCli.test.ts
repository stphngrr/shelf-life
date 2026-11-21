// ABOUTME: Integration tests for the `import-npr` command-line script.
// ABOUTME: Runs the real script as a child process against a local HTTP server and the local database.

import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fileURLToPath } from 'node:url'
import { resetDatabase, sql } from './supabase.ts'

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url))
const FIXTURE = readFileSync(new URL('../fixtures/npr-shelf-sample.json', import.meta.url), 'utf-8')

interface CliResult {
  code: number
  stdout: string
  stderr: string
}

function runCli(args: string[], env: NodeJS.ProcessEnv = process.env): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(process.execPath, ['scripts/import-npr.ts', ...args], { cwd: PROJECT_ROOT, env }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code as number) : 0, stdout, stderr })
    })
  })
}

async function countEntries(): Promise<number> {
  const rows = await sql<{ count: string }>('select count(*) from public.list_entries')
  return Number(rows[0].count)
}

describe('import-npr CLI', () => {
  let server: Server
  let baseUrl: string
  let unreachableUrl: string

  beforeAll(async () => {
    const closed = createServer()
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve))
    unreachableUrl = `http://127.0.0.1:${(closed.address() as AddressInfo).port}/shelf.json`
    await new Promise((resolve) => closed.close(resolve))

    server = createServer((request, response) => {
      if (request.url === '/shelf.json') {
        response.writeHead(200, { 'content-type': 'application/json' }).end(FIXTURE)
      } else if (request.url === '/malformed.json') {
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"books": []}')
      } else if (request.url === '/not-json') {
        response.writeHead(200, { 'content-type': 'text/html' }).end('<html>Maintenance</html>')
      } else {
        response.writeHead(404).end()
      }
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  it('imports the feed and prints a summary with data warnings', async () => {
    const result = await runCli(['--source', `${baseUrl}/shelf.json`])

    expect(result).toMatchObject({ code: 0, stderr: '' })
    expect(result.stdout).toBe(
      [
        `Fetched 26 records from ${baseUrl}/shelf.json`,
        'Imported into npr-books-we-love: 26 added, 0 updated, 0 unchanged, 0 removed',
        'Warnings (5):',
        '  2024:172 "Not a Speck of Light": no ISBN',
        '  2024:276 "The Nightmare Box and Other Stories": no ISBN',
        '  2022:344 "Tangier in the Rain": no ISBN',
        '  2020:364 "The Things They Fancied": no ISBN',
        '  2021:325 "The Vixen: A Novel": dropped story link with no url (KALW)',
        '',
      ].join('\n'),
    )
    expect(await countEntries()).toBe(26)
  })

  it('reports everything unchanged on a second run', async () => {
    await runCli(['--source', `${baseUrl}/shelf.json`])

    const result = await runCli(['--source', `${baseUrl}/shelf.json`])

    expect(result.code).toBe(0)
    expect(result.stdout).toContain('Imported into npr-books-we-love: 0 added, 0 updated, 26 unchanged, 0 removed')
  })

  it('fails without writing anything when the host refuses the connection', async () => {
    const result = await runCli(['--source', unreachableUrl])

    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe(`NPR import failed: Could not fetch NPR shelf from ${unreachableUrl}: fetch failed (ECONNREFUSED)\n`)
    expect(await countEntries()).toBe(0)
  })

  it.each([
    ['the server returns an error status', '/missing.json', 'NPR shelf request failed: 404 Not Found'],
    ['the response is not JSON', '/not-json', 'NPR shelf is not valid JSON: Unexpected token'],
    ['the feed has the wrong shape', '/malformed.json', 'NPR shelf must be an array of records'],
  ])('fails without writing anything when %s', async (_case, path, message) => {
    const result = await runCli(['--source', `${baseUrl}${path}`])

    expect(result.code).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(`NPR import failed: ${message}`)
    expect(await countEntries()).toBe(0)
  })

  it('fails with a clear message when the database URL is not set', async () => {
    const env = { ...process.env }
    delete env.SUPABASE_DB_URL

    const result = await runCli(['--source', `${baseUrl}/shelf.json`], env)

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('NPR import failed: Missing env var SUPABASE_DB_URL')
  })

  it('rejects an unknown argument', async () => {
    const result = await runCli(['--sauce', `${baseUrl}/shelf.json`])

    expect(result.code).toBe(1)
    expect(result.stderr).toContain('NPR import failed: Unknown argument "--sauce"')
  })
})
