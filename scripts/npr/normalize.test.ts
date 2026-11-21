// ABOUTME: Tests for turning parsed NPR records into catalog entries ready to import.
// ABOUTME: Uses real fixture records for NPR's quirks and small synthetic records for edge cases.
// @vitest-environment node

import { readFileSync } from 'node:fs'
import { parseShelf, type NprRecord } from './parseShelf.ts'
import { normalizeRecord, normalizeShelf } from './normalize.ts'

const fixture = parseShelf(
  JSON.parse(readFileSync(new URL('../../tests/fixtures/npr-shelf-sample.json', import.meta.url), 'utf-8')),
)

function fixtureRecord(year: number, id: number): NprRecord {
  const record = fixture.find((r) => r.year === year && r.id === id)
  if (!record) throw new Error(`fixture has no record ${year}:${id}`)
  return record
}

function normalizeFixture(year: number, id: number) {
  return normalizeRecord(fixtureRecord(year, id)).entry
}

function syntheticRecord(overrides: Partial<NprRecord> = {}): NprRecord {
  return {
    id: 7,
    year: 2025,
    title: 'A Title',
    author: 'An Author',
    reviewers: ['A Reviewer'],
    text: '<p>A blurb.</p>',
    tags: ['fiction'],
    isbn: '0123456789',
    isbn10: '0123456789',
    isbn13: '9780123456786',
    cover: '0123456789',
    links: [],
    ...overrides,
  }
}

describe('normalizeRecord', () => {
  it('builds a complete catalog entry from a real record', () => {
    expect(normalizeRecord(fixtureRecord(2025, 1))).toEqual({
      entry: {
        sourceKey: '2025:1',
        book: {
          title: 'A Book of Maps for You',
          author: 'Lourdes Heuer, illustrated by Maxwell Eaton III',
          isbn10: '082345570X',
          isbn13: '9780823455706',
          coverUrl: 'https://apps.npr.org/best-books/assets/synced/covers/2025/082345570X.jpg',
        },
        entry: {
          year: 2025,
          edition: 'fall',
          tags: ['kids’ books'],
          blurbHtml: fixtureRecord(2025, 1).text,
          reviewers: ['Betsy Bird'],
          externalLinks: {
            listPage: 'https://apps.npr.org/best-books/#year=2025&book=1',
            goodreads: 'https://www.goodreads.com/book/show/211401555',
            bookshop: 'https://bookshop.org/a/88656/9780823455706',
            worldcat: 'https://www.worldcat.org/isbn/082345570X',
            stories: [],
          },
        },
      },
      warnings: [],
    })
  })

  describe('text fields', () => {
    it('decodes HTML entities in the author', () => {
      expect(normalizeFixture(2022, 155).book.author).toBe('Isabel Cañas')
    })

    it('decodes entities mixed with literal accented characters', () => {
      expect(normalizeFixture(2021, 295).book.author).toBe('Colm Tóibín')
    })

    it('decodes HTML entities in reviewer names', () => {
      expect(normalizeFixture(2025, 191).entry.reviewers).toEqual(['Minh Lê'])
      expect(normalizeFixture(2025, 34).entry.reviewers).toEqual(['Thúy Ðinh'])
    })

    it('leaves a literal ampersand in the title alone', () => {
      expect(normalizeFixture(2025, 203).book.title).toBe('Psychopomp & Circumstance')
    })

    it('trims the title, author, and reviewers', () => {
      const { entry } = normalizeRecord(
        syntheticRecord({ title: ' A Title ', author: ' An Author\n', reviewers: [' One ', 'Two '] }),
      )

      expect(entry.book.title).toBe('A Title')
      expect(entry.book.author).toBe('An Author')
      expect(entry.entry.reviewers).toEqual(['One', 'Two'])
    })

    it('keeps the blurb HTML exactly as NPR provides it', () => {
      expect(normalizeRecord(syntheticRecord({ text: ' <p>Raw <em>HTML</em></p> ' })).entry.entry.blurbHtml).toBe(
        ' <p>Raw <em>HTML</em></p> ',
      )
    })
  })

  describe('edition', () => {
    it.each([
      [2024, 1, 'fall'],
      [2024, 8, 'summer'],
      [2022, 1, 'june'],
      [2025, 22, 'book ahead'],
      [2025, 262, 'fall (summer rewrite)'],
      [2025, 387, null],
      [2013, 1, null],
    ])('normalizes %i:%i to %s', (year, id, edition) => {
      expect(normalizeFixture(year, id).entry.edition).toBe(edition)
    })

    it('trims surrounding whitespace', () => {
      expect(normalizeRecord(syntheticRecord({ edition: ' Summer ' })).entry.entry.edition).toBe('summer')
    })
  })

  describe('tags', () => {
    it('trims, lowercases, curls apostrophes, drops empties, and removes duplicates', () => {
      const { entry } = normalizeRecord(syntheticRecord({ tags: [' Fiction ', "kids' books", 'fiction', ' ', 'Kids’ Books'] }))

      expect(entry.entry.tags).toEqual(['fiction', 'kids’ books'])
    })
  })

  describe('ISBNs', () => {
    it('uses the 10- and 13-digit ISBNs NPR computed', () => {
      expect(normalizeFixture(2025, 1).book).toMatchObject({ isbn10: '082345570X', isbn13: '9780823455706' })
    })

    it('drops the ISBN-10 NPR derives for a 979 ISBN-13, which has no ISBN-10', () => {
      expect(normalizeFixture(2025, 376).book).toMatchObject({ isbn10: null, isbn13: '9798217047802' })
    })

    it('stores no ISBNs and warns when NPR has none', () => {
      const { entry, warnings } = normalizeRecord(fixtureRecord(2024, 172))

      expect(entry.book).toMatchObject({ isbn10: null, isbn13: null })
      expect(warnings).toEqual(['2024:172 "Not a Speck of Light": no ISBN'])
    })
  })

  describe('cover', () => {
    it('builds the cover URL from the cover name even when it is not the ISBN', () => {
      expect(normalizeFixture(2023, 1).book.coverUrl).toBe(
        'https://apps.npr.org/best-books/assets/synced/covers/2023/blackouts-torres.jpg',
      )
    })

    it('encodes characters that are unsafe in a URL path', () => {
      expect(normalizeRecord(syntheticRecord({ cover: 'a cover#1' })).entry.book.coverUrl).toBe(
        'https://apps.npr.org/best-books/assets/synced/covers/2025/a%20cover%231.jpg',
      )
    })

    it('stores no cover URL when the cover name is blank', () => {
      expect(normalizeRecord(syntheticRecord({ cover: ' ' })).entry.book.coverUrl).toBeNull()
    })
  })

  describe('external links', () => {
    it('links to Apple Books from the iTunes id', () => {
      const links = normalizeRecord(syntheticRecord({ itunes: 9780374178710 })).entry.entry.externalLinks

      expect(links.appleBooks).toBe('https://goto.applebooks.apple/US/9780374178710?at=11l79Y')
    })

    it('omits sites whose id is missing or an empty string', () => {
      const links = normalizeFixture(2018, 6).entry.externalLinks

      expect(links).not.toHaveProperty('goodreads')
      expect(links).not.toHaveProperty('appleBooks')
      expect(links.bookshop).toBe('https://bookshop.org/a/88656/9781941628102')
    })

    it('omits Bookshop when NPR has no Bookshop id', () => {
      expect(normalizeFixture(2020, 12).entry.externalLinks).not.toHaveProperty('bookshop')
    })

    it('omits WorldCat when there is no ISBN', () => {
      expect(normalizeFixture(2024, 172).entry.externalLinks).not.toHaveProperty('worldcat')
    })

    it('keeps story links with their text trimmed', () => {
      expect(normalizeFixture(2025, 31).entry.externalLinks.stories).toEqual([
        {
          source: 'NPR',
          text: 'A new James Baldwin biography explores how his lovers influenced his work',
          url: 'https://www.npr.org/2025/10/08/nx-s1-5154994/james-baldwin-love-story-nicholas-boggs',
        },
        {
          source: 'WAMC',
          text: "The Roundtable: Nicholas Boggs on 'Baldwin: A Love Story'",
          url: 'https://www.wamc.org/podcast/the-roundtable/2025-08-29/nicholas-boggs-new-book-is-baldwin-a-love-story',
        },
      ])
    })

    it('drops a story link that has no url, with a warning', () => {
      const { entry, warnings } = normalizeRecord(fixtureRecord(2021, 325))

      expect(entry.entry.externalLinks.stories.map((s) => s.source)).toEqual(['NPR', 'WSHU'])
      expect(warnings).toEqual(['2021:325 "The Vixen: A Novel": dropped story link with no url (KALW)'])
    })
  })
})

describe('normalizeShelf', () => {
  it('normalizes every record and collects all warnings', () => {
    const { entries, warnings } = normalizeShelf(fixture)

    expect(entries).toHaveLength(26)
    expect(warnings).toEqual([
      '2024:172 "Not a Speck of Light": no ISBN',
      expect.stringMatching(/^2024:276 .*: no ISBN$/),
      expect.stringMatching(/^2022:344 .*: no ISBN$/),
      expect.stringMatching(/^2020:364 .*: no ISBN$/),
      '2021:325 "The Vixen: A Novel": dropped story link with no url (KALW)',
    ])
  })
})
