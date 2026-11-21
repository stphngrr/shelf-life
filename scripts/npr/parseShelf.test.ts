// ABOUTME: Tests for parsing NPR's shelf.json feed into typed records.
// ABOUTME: Covers the real fixture plus malformed, empty, and duplicate feeds.
// @vitest-environment node

import { readFileSync } from 'node:fs'
import { parseShelf } from './parseShelf.ts'

const fixture: unknown = JSON.parse(
  readFileSync(new URL('../../tests/fixtures/npr-shelf-sample.json', import.meta.url), 'utf-8'),
)

function validRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    year: 2025,
    title: 'A Title',
    author: 'An Author',
    reviewers: ['A Reviewer'],
    text: '<p>A blurb.</p>',
    tags: ['fiction'],
    isbn: '0123456789',
    cover: '0123456789',
    links: [],
    ...overrides,
  }
}

function withoutField(field: string): Record<string, unknown> {
  const record = validRecord()
  delete record[field]
  return record
}

describe('parseShelf', () => {
  it('parses every record in the real NPR fixture', () => {
    const records = parseShelf(fixture)

    expect(records).toHaveLength(26)
    expect(records[0]).toEqual({
      id: 1,
      year: 2025,
      edition: 'fall',
      title: 'A Book of Maps for You',
      author: 'Lourdes Heuer, illustrated by Maxwell Eaton III',
      reviewers: ['Betsy Bird'],
      text: expect.stringContaining('Kids often have to do map units in school'),
      tags: ['kids’ books'],
      isbn: '082345570X',
      isbn10: '082345570X',
      isbn13: '9780823455706',
      cover: '082345570X',
      goodreads: 211401555,
      bookshop: 9780823455706,
      itunes: '',
      links: [],
    })
  })

  it('keeps only the fields the import uses', () => {
    const [record] = parseShelf([validRecord({ seamus: 123, image: 'https://x', editor: 'Petra', oclc: 1 })])

    expect(Object.keys(record).sort()).toEqual(
      ['author', 'cover', 'id', 'isbn', 'links', 'reviewers', 'tags', 'text', 'title', 'year'].sort(),
    )
  })

  it('keeps story links with only their source, text, and url', () => {
    const link = { year: 2025, id: 7, book: 'A Title', source: 'NPR', text: 'A story', url: 'https://npr.org/x' }

    const [record] = parseShelf([validRecord({ links: [link] })])

    expect(record.links).toEqual([{ source: 'NPR', text: 'A story', url: 'https://npr.org/x' }])
  })

  it('accepts a story link with no url, as NPR has for 2021:325', () => {
    const [record] = parseShelf([validRecord({ links: [{ source: 'KALW', text: 'A story' }] })])

    expect(record.links).toEqual([{ source: 'KALW', text: 'A story' }])
  })

  it.each([
    ['a number', 211401555],
    ['an empty string', ''],
  ])('accepts an external id that is %s', (_label, value) => {
    expect(() => parseShelf([validRecord({ goodreads: value, bookshop: value, itunes: value })])).not.toThrow()
  })

  it('rejects a feed that is not an array', () => {
    expect(() => parseShelf({ books: [] })).toThrow('NPR shelf must be an array of records')
  })

  it('rejects an empty feed', () => {
    expect(() => parseShelf([])).toThrow('NPR shelf is empty')
  })

  it('rejects a record that is not an object', () => {
    expect(() => parseShelf([validRecord(), 'oops'])).toThrow('NPR record #1: must be an object')
  })

  it.each([
    ['id', withoutField('id'), '"id" must be an integer'],
    ['year', validRecord({ year: '2025' }), '"year" must be an integer'],
    ['title', validRecord({ title: 42 }), '"title" must be a string'],
    ['author', withoutField('author'), '"author" must be a string'],
    ['text', withoutField('text'), '"text" must be a string'],
    ['isbn', withoutField('isbn'), '"isbn" must be a string'],
    ['cover', validRecord({ cover: null }), '"cover" must be a string'],
    ['reviewers', validRecord({ reviewers: 'A Reviewer' }), '"reviewers" must be an array of strings'],
    ['tags', validRecord({ tags: ['fiction', 3] }), '"tags" must be an array of strings'],
    ['links', withoutField('links'), '"links" must be an array'],
    ['link source', validRecord({ links: [{ text: 'A story', url: 'https://x' }] }), '"links[0].source" must be a string'],
    ['link url', validRecord({ links: [{ source: 'NPR', text: 'A story', url: 5 }] }), '"links[0].url" must be a string if present'],
    ['edition', validRecord({ edition: 2 }), '"edition" must be a string if present'],
    ['isbn13', validRecord({ isbn13: 9780823455706 }), '"isbn13" must be a string if present'],
    ['goodreads', validRecord({ goodreads: '211401555' }), '"goodreads" must be a number or empty string if present'],
  ])('rejects a record with an invalid %s', (_field, record, message) => {
    expect(() => parseShelf([record])).toThrow(message)
  })

  it('identifies the bad record by position and year:id', () => {
    expect(() => parseShelf([validRecord(), validRecord({ id: 9, title: null })])).toThrow(
      'NPR record #1 (2025:9): "title" must be a string',
    )
  })

  it('rejects duplicate year:id pairs', () => {
    expect(() => parseShelf([validRecord(), validRecord({ title: 'Other' })])).toThrow(
      'NPR record #1 (2025:7): duplicate of an earlier record',
    )
  })
})
