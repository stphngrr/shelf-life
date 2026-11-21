// ABOUTME: Converts parsed NPR records into catalog entries, cleaning up NPR's data quirks.
// ABOUTME: Reports data problems as warnings rather than failing, since they affect single books.

import { decodeHTML } from 'entities'
import type { CatalogEntry, ExternalLinks, StoryLink } from '../catalog/catalogEntry.ts'
import type { NprExternalId, NprRecord } from './parseShelf.ts'

const NPR_BASE_URL = 'https://apps.npr.org/best-books/'

// Link formats match NPR's own book page, including its affiliate codes.
const externalSiteUrls = {
  goodreads: (id: number) => `https://www.goodreads.com/book/show/${id}`,
  bookshop: (id: number) => `https://bookshop.org/a/88656/${id}`,
  appleBooks: (id: number) => `https://goto.applebooks.apple/US/${id}?at=11l79Y`,
}

export interface NormalizedRecord {
  entry: CatalogEntry
  warnings: string[]
}

function cleanText(value: string): string {
  return decodeHTML(value).trim()
}

function normalizeEdition(edition: string | undefined): string | null {
  const cleaned = edition?.trim().toLowerCase()
  return cleaned ? cleaned : null
}

/** Matches NPR's own tag normalization: lowercase, with apostrophes curled. */
function normalizeTags(tags: string[]): string[] {
  const cleaned = tags.map((tag) => tag.trim().toLowerCase().replace(/['’]/g, '’')).filter((tag) => tag)
  return [...new Set(cleaned)]
}

function nullIfBlank(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeIsbns(record: NprRecord): { isbn10: string | null; isbn13: string | null } {
  const isbn13 = nullIfBlank(record.isbn13)
  // NPR derives an ISBN-10 for every ISBN-13, but 979-prefixed ISBNs have no ISBN-10.
  const isbn10 = isbn13?.startsWith('979') ? null : nullIfBlank(record.isbn10)
  return { isbn10, isbn13 }
}

function coverUrl(record: NprRecord): string | null {
  const cover = record.cover.trim()
  return cover ? `${NPR_BASE_URL}assets/synced/covers/${record.year}/${encodeURIComponent(cover)}.jpg` : null
}

function siteUrl(id: NprExternalId | undefined, build: (id: number) => string): string | undefined {
  return typeof id === 'number' ? build(id) : undefined
}

function buildExternalLinks(record: NprRecord, stories: StoryLink[]): ExternalLinks {
  const isbn = record.isbn.trim()
  const candidates: Omit<ExternalLinks, 'stories'> = {
    listPage: `${NPR_BASE_URL}#year=${record.year}&book=${record.id}`,
    goodreads: siteUrl(record.goodreads, externalSiteUrls.goodreads),
    bookshop: siteUrl(record.bookshop, externalSiteUrls.bookshop),
    appleBooks: siteUrl(record.itunes, externalSiteUrls.appleBooks),
    worldcat: isbn ? `https://www.worldcat.org/isbn/${isbn}` : undefined,
  }
  const present = Object.fromEntries(Object.entries(candidates).filter(([, url]) => url !== undefined))
  return { ...present, stories }
}

export function normalizeRecord(record: NprRecord): NormalizedRecord {
  const sourceKey = `${record.year}:${record.id}`
  const title = cleanText(record.title)
  const label = `${sourceKey} "${title}"`
  const warnings: string[] = []

  const isbns = normalizeIsbns(record)
  if (!isbns.isbn10 && !isbns.isbn13) warnings.push(`${label}: no ISBN`)

  const stories: StoryLink[] = []
  for (const link of record.links) {
    if (link.url) {
      stories.push({ source: link.source.trim(), text: link.text.trim(), url: link.url.trim() })
    } else {
      warnings.push(`${label}: dropped story link with no url (${link.source})`)
    }
  }

  return {
    entry: {
      sourceKey,
      book: {
        title,
        author: cleanText(record.author),
        ...isbns,
        coverUrl: coverUrl(record),
      },
      entry: {
        year: record.year,
        edition: normalizeEdition(record.edition),
        tags: normalizeTags(record.tags),
        blurbHtml: record.text,
        reviewers: record.reviewers.map(cleanText),
        externalLinks: buildExternalLinks(record, stories),
      },
    },
    warnings,
  }
}

export function normalizeShelf(records: NprRecord[]): { entries: CatalogEntry[]; warnings: string[] } {
  const normalized = records.map(normalizeRecord)
  return {
    entries: normalized.map((n) => n.entry),
    warnings: normalized.flatMap((n) => n.warnings),
  }
}
