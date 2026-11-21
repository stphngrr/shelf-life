// ABOUTME: Parses NPR's Books We Love shelf.json feed into typed records.
// ABOUTME: Rejects anything malformed so a changed feed aborts the import instead of corrupting data.

export interface NprStoryLink {
  source: string
  text: string
  /** Missing on at least one real NPR link. */
  url?: string
}

/** NPR stores missing external ids as an empty string. */
export type NprExternalId = number | ''

export interface NprRecord {
  id: number
  year: number
  edition?: string
  title: string
  author: string
  reviewers: string[]
  /** Recommendation blurb as HTML. */
  text: string
  tags: string[]
  isbn: string
  isbn10?: string
  isbn13?: string
  /** Cover image file name; usually, but not always, the ISBN. */
  cover: string
  goodreads?: NprExternalId
  bookshop?: NprExternalId
  itunes?: NprExternalId
  links: NprStoryLink[]
}

type RawRecord = Record<string, unknown>

function isObject(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function requireInteger(raw: RawRecord, field: string): number {
  const value = raw[field]
  if (!Number.isInteger(value)) throw new Error(`"${field}" must be an integer`)
  return value as number
}

function requireString(raw: RawRecord, field: string, path = field): string {
  const value = raw[field]
  if (typeof value !== 'string') throw new Error(`"${path}" must be a string`)
  return value
}

function requireStringArray(raw: RawRecord, field: string): string[] {
  const value = raw[field]
  if (!isStringArray(value)) throw new Error(`"${field}" must be an array of strings`)
  return value
}

function optionalString(raw: RawRecord, field: string, path = field): string | undefined {
  const value = raw[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`"${path}" must be a string if present`)
  return value
}

function optionalExternalId(raw: RawRecord, field: string): NprExternalId | undefined {
  const value = raw[field]
  if (value === undefined) return undefined
  if (value !== '' && !Number.isInteger(value)) {
    throw new Error(`"${field}" must be a number or empty string if present`)
  }
  return value as NprExternalId
}

function requireLinks(raw: RawRecord): NprStoryLink[] {
  const value = raw.links
  if (!Array.isArray(value)) throw new Error('"links" must be an array')
  return value.map((link, index) => {
    if (!isObject(link)) throw new Error(`"links[${index}]" must be an object`)
    const storyLink: NprStoryLink = {
      source: requireString(link, 'source', `links[${index}].source`),
      text: requireString(link, 'text', `links[${index}].text`),
    }
    return withOptional(storyLink, { url: optionalString(link, 'url', `links[${index}].url`) })
  })
}

/** Copies optional fields onto the record only when present, so absent fields stay absent. */
function withOptional<T extends object>(record: T, optional: Partial<T>): T {
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) Object.assign(record, { [key]: value })
  }
  return record
}

function parseRecord(raw: RawRecord): NprRecord {
  const record: NprRecord = {
    id: requireInteger(raw, 'id'),
    year: requireInteger(raw, 'year'),
    title: requireString(raw, 'title'),
    author: requireString(raw, 'author'),
    reviewers: requireStringArray(raw, 'reviewers'),
    text: requireString(raw, 'text'),
    tags: requireStringArray(raw, 'tags'),
    isbn: requireString(raw, 'isbn'),
    cover: requireString(raw, 'cover'),
    links: requireLinks(raw),
  }
  return withOptional(record, {
    edition: optionalString(raw, 'edition'),
    isbn10: optionalString(raw, 'isbn10'),
    isbn13: optionalString(raw, 'isbn13'),
    goodreads: optionalExternalId(raw, 'goodreads'),
    bookshop: optionalExternalId(raw, 'bookshop'),
    itunes: optionalExternalId(raw, 'itunes'),
  })
}

function describeRecord(raw: unknown, index: number): string {
  if (isObject(raw) && Number.isInteger(raw.year) && Number.isInteger(raw.id)) {
    return `NPR record #${index} (${raw.year}:${raw.id})`
  }
  return `NPR record #${index}`
}

/** Validates the whole feed and returns its records, or throws describing the first problem. */
export function parseShelf(raw: unknown): NprRecord[] {
  if (!Array.isArray(raw)) throw new Error('NPR shelf must be an array of records')
  if (raw.length === 0) throw new Error('NPR shelf is empty')

  const seenKeys = new Set<string>()
  return raw.map((item, index) => {
    const label = describeRecord(item, index)
    if (!isObject(item)) throw new Error(`${label}: must be an object`)

    let record: NprRecord
    try {
      record = parseRecord(item)
    } catch (error) {
      throw new Error(`${label}: ${(error as Error).message}`, { cause: error })
    }

    const key = `${record.year}:${record.id}`
    if (seenKeys.has(key)) throw new Error(`${label}: duplicate of an earlier record`)
    seenKeys.add(key)
    return record
  })
}
