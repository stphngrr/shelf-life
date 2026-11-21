// ABOUTME: Command-line entry point that imports NPR's Books We Love feed into the catalog.
// ABOUTME: Usage: node scripts/import-npr.ts [--source <shelf.json URL>]; requires SUPABASE_DB_URL.

import pg from 'pg'
import { importCatalogEntries } from './catalog/importEntries.ts'
import { normalizeShelf } from './npr/normalize.ts'
import { parseShelf } from './npr/parseShelf.ts'

const NPR_SHELF_URL = 'https://apps.npr.org/best-books/shelf.json'
const NPR_LIST_SLUG = 'npr-books-we-love'
const FETCH_TIMEOUT_MS = 120_000

function parseArgs(args: string[]): { source: string } {
  let source = NPR_SHELF_URL
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--source' && args[i + 1]) {
      source = args[++i]
    } else {
      throw new Error(`Unknown argument "${args[i]}"`)
    }
  }
  return { source }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

/** Node's fetch reports network failures as "fetch failed", with the system error code on its cause. */
function describeFetchError(error: unknown): string {
  const { message, cause } = error as Error & { cause?: { code?: string; message?: string } }
  const detail = cause?.code ?? cause?.message
  return detail ? `${message} (${detail})` : message
}

async function fetchShelf(url: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  } catch (error) {
    throw new Error(`Could not fetch NPR shelf from ${url}: ${describeFetchError(error)}`, { cause: error })
  }
  if (!response.ok) throw new Error(`NPR shelf request failed: ${response.status} ${response.statusText}`)

  const body = await response.text()
  try {
    return JSON.parse(body)
  } catch (error) {
    throw new Error(`NPR shelf is not valid JSON: ${(error as Error).message}`, { cause: error })
  }
}

async function main(): Promise<void> {
  const { source } = parseArgs(process.argv.slice(2))
  const databaseUrl = requireEnv('SUPABASE_DB_URL')

  const records = parseShelf(await fetchShelf(source))
  const { entries, warnings } = normalizeShelf(records)

  const db = new pg.Client({ connectionString: databaseUrl })
  await db.connect()
  let summary
  try {
    summary = await importCatalogEntries(db, NPR_LIST_SLUG, entries)
  } finally {
    await db.end()
  }

  const lines = [
    `Fetched ${records.length} records from ${source}`,
    `Imported into ${NPR_LIST_SLUG}: ${summary.added} added, ${summary.updated} updated, ` +
      `${summary.unchanged} unchanged, ${summary.removed} removed`,
  ]
  if (warnings.length > 0) {
    lines.push(`Warnings (${warnings.length}):`, ...warnings.map((warning) => `  ${warning}`))
  }
  console.log(lines.join('\n'))
}

main().catch((error: unknown) => {
  console.error(`NPR import failed: ${(error as Error).message}`)
  process.exitCode = 1
})
