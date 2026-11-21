# shelf-life — Design Spec

Date: 2026-11-19
Status: Approved (design walkthrough with Stephanie)

## 1. Overview

shelf-life is a private, single-user web app for tracking books from NPR's
Books We Love lists (https://apps.npr.org/best-books/). Each book can be
marked **Want to read**, **Read** (optional date read, optional 0–5 rating in
quarter steps), or **Dismissed**, or left unmarked. Data persists in a hosted
database and is accessible from any browser.

## 2. Architecture

1. **Frontend** — static SPA: React + Vite + TypeScript + Vitest. Hosted on
   GitHub Pages from the public repo `stphngrr/shelf-life`. Talks directly to
   Supabase via `@supabase/supabase-js`. No app server.
2. **Supabase (free tier)** — Postgres for catalog and statuses; Supabase Auth
   with email magic link; Row Level Security so nothing is readable without
   login. Signups disabled.
3. **Import script** — Node/TS CLI (`npm run import:npr`) that fetches NPR's
   `shelf.json`, normalizes, and upserts into catalog tables. Never touches
   statuses.
4. **GitHub Actions** — deploy to Pages; daily keep-alive (with heartbeat
   commit when needed); weekly NPR import; weekly export of reading data to the
   private repo `stphngrr/shelf-life-data`.
5. **Local dev** — OrbStack + Supabase CLI (`supabase start`). Schema changes
   are versioned migrations. Integration tests run against real local Supabase.

**Paused-backend safety net:** if Supabase is unreachable/paused, the frontend
shows a clear "backend paused — restore it in the Supabase dashboard" message.

### Supabase free tier facts (verified 2026-11-19)

- 500 MB DB, 50K MAU, 5 GB egress, 2 active projects; Pro is $25/mo.
- Free projects pause after 1 week of low activity; restorable from the
  dashboard for 90 days, after which only backup-download recovery is
  documented. Hence keep-alive + independent JSON export.

## 3. Data source (NPR)

- `https://apps.npr.org/best-books/shelf.json` — all books 2013–2025, 4,371
  records, ~2 MB, served gzipped. Per-year `{year}.json` / `{year}-detail.json`
  also exist. 2026 expected late November 2026.
- Record fields: `id`, `year`, `edition` (inconsistent casing, e.g. `Fall` /
  `fall`, and odd values like `fall (summer rewrite)`, `book ahead`), `title`,
  `author`, `reviewers[]`, `text` (HTML blurb), `tags[]`, `isbn`, `isbn10`,
  `isbn13`, `cover`, `goodreads`, `bookshop`, `itunes`, `image`, `links[]`.
- Natural key: `year` + `id` (ids repeat across years).
- 32 tags. No title+author duplicates across years; two duplicate ISBN-13s are
  NPR data errors; 4 records lack an ISBN.
- Covers: `https://apps.npr.org/best-books/assets/synced/covers/{year}/{cover}.jpg`
  (hotlinked).
- Source code: https://github.com/nprapps/book-concierge (`tasks/shelve.js`
  builds these files).

## 4. Data model

**`lists`** — `id`, `slug` (`npr-books-we-love`), `name`, `source_url`.

**`books`** — the work: `id` (uuid), `title`, `author`, `isbn10`, `isbn13`,
`cover_url`. For NPR, one book per entry. Cross-list matching is future work.

**`list_entries`** — a book's appearance on a list: `id` (uuid), `list_id`,
`book_id`, `source_key` (NPR: `"{year}:{id}"`, unique per list), `year`,
`edition` (lowercased), `tags text[]`, `blurb_html`, `reviewers text[]`,
`external_links jsonb`, `removed_from_source_at` (nullable), `imported_at`,
`updated_at`.

**`book_statuses`** — `user_id`, `book_id` (composite PK), `status` enum
(`want_to_read`, `read`, `dismissed`), `date_read date` null,
`rating_quarters smallint` null with `CHECK (rating_quarters BETWEEN 0 AND 20)`,
`updated_at`. `CHECK`: `date_read` and `rating_quarters` must be null unless
`status = 'read'`. No row = unmarked.

**Status transitions:** exactly one state per book. Leaving Read clears date
and rating (UI confirms first). Unmarking deletes the row.

**Rating:** 0–5 stars in 0.25 steps, stored as quarters 0–20 (15 = 3.75★).
NULL = not rated; 0 = explicit zero stars.

**RLS:**
- `lists`, `books`, `list_entries`: `SELECT` for `authenticated` only. Writes
  only by the import script over a direct Postgres connection.
- `book_statuses`: all operations only where `user_id = auth.uid()`.

## 5. Frontend UI

- **Login:** email → magic link; session persists.
- **Filter bar:** Years (multi-select, OR; none selected = all years, which
  is the default), Tags (multi-select, AND), Status (multi-select; default all
  but dismissed), title/author search, result count, clear filters.
- **Search spans all years** regardless of the year selection; tag and
  status filters still apply to search results.
- **URL state:** filters encoded in the hash, e.g.
  `#years=2024,2025&tags=fiction&status=unmarked`.
- **Views:** Grid (covers + title/author, status badge) and List (thumbnail,
  title, author, year, tags, status). Toggle remembered per device
  (localStorage, wrapped in try/catch).
- **Quick-mark buttons** on every card/row: Want · Read · Dismiss. Tap to set;
  tap the active one to unmark. Quick "Read" sets no date/rating.
- **Optimistic updates** with rollback + visible error on failure.
- **Detail panel** (side panel desktop, full screen mobile): cover, title,
  author, year, edition, tags, reviewers, blurb, links (Goodreads, Bookshop,
  NPR), status controls; when Read: date picker and 0–5 rating stepper/slider
  in 0.25 steps with star rendering. Note shown if removed from NPR's list.
- **Loading:** list fields (no blurbs) loaded once per session; filtering is
  client-side. Blurbs fetched on demand in the detail panel.
- **Responsive:** must work well on a phone.

## 6. Import, scheduled jobs, export

**`npm run import:npr`:**
1. Fetch `shelf.json` (7.1 MB uncompressed, ~2 MB gzipped); on fetch failure,
   schema mismatch, duplicate `year:id`, or an empty feed, abort with a clear
   error and write nothing.
2. Normalize:
   - title, author, reviewers: decode HTML entities (NPR stores e.g.
     `Minh L&ecirc;`), trim.
   - edition: trimmed, lowercased; empty or missing → null.
   - tags: trimmed, lowercased, straight apostrophes → `’` (as NPR does),
     empties dropped, de-duplicated.
   - ISBNs from `isbn10`/`isbn13`; empty or missing → null (warning). NPR
     derives a bogus ISBN-10 for 979-prefixed ISBN-13s, which have none → null.
   - `cover_url` from year + `cover` (`cover` is not always the ISBN).
   - `blurb_html`: NPR's HTML as-is; sanitized at render time.
   - `external_links` (camelCase JSON), using NPR's own URL formats incl. its
     affiliate codes: `listPage` (the book's page on NPR's site,
     `…/best-books/#year=Y&book=ID`), `goodreads`, `bookshop`, `appleBooks`,
     `worldcat` (from ISBN), and `stories` (`source`, trimmed `text`, `url`;
     links without a url are dropped with a warning). External ids that are
     `''` or missing are omitted.
3. Upsert in one Postgres transaction over a direct connection, keyed on
   `(list_id, source_key)`. New → create book + entry. Existing → update entry
   and the book's title/author/ISBNs/cover only if something changed.
4. Entries missing from the feed get `removed_from_source_at` set (cleared if
   they reappear). Never deleted.
5. Print summary: added / updated / unchanged / flagged-removed / data
   warnings (e.g. missing ISBN).
Idempotent.

**Workflows:**
- `deploy.yml` — push to `main`: typecheck, test, build, publish to Pages.
- `keep-alive.yml` — daily: one authenticated query against Supabase; fails
  loudly if unreachable. If the repo's last commit is >30 days old, commits
  `heartbeat.txt` so GitHub doesn't disable scheduled workflows (60-day rule).
- `import.yml` — weekly + manual `workflow_dispatch`: runs the NPR import.
- `export.yml` — weekly: dumps `book_statuses` joined with title/author/ISBNs
  to a dated JSON file committed to private `stphngrr/shelf-life-data`.

**Secrets** (GitHub Actions only, never in code): the Postgres connection
string (`SUPABASE_DB_URL`, via Supabase's connection pooler in session mode,
because Actions runners lack IPv6 and the free-tier direct connection is
IPv6-only), and a token/deploy key for `shelf-life-data`. The database
connection bypasses RLS. The frontend uses only the publishable key
(`sb_publishable_…`).

**Env vars** (see `.env.example`): `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (frontend); `SUPABASE_DB_URL` (scripts and
integration tests); `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (integration tests).
None of the non-`VITE_` values can be bundled.

## 7. Testing

TDD for all features.
- **Unit (Vitest, co-located):** normalization, filter matching, URL state
  encode/decode, rating conversion, status transition rules.
- **Component (Vitest + React Testing Library):** filter bar, grid/list,
  quick-mark, detail panel, rating input.
- **Integration (real local Supabase, no mocks):** RLS (anon sees nothing,
  cross-user isolation), CHECK constraints, import against a real fixture
  slice of `shelf.json` (first run, idempotent re-run, removal flagging),
  status data layer. DB reset between suites.
- **E2E (Playwright, local Supabase + dev server):** login, filter, mark read
  with date + rating, reload, verify persisted.
- Test output must be pristine; intentional errors are captured and asserted.

## 8. Repo layout

```
shelf-life/
  src/              # React app
    lib/            # filters, ratings, URL state (pure)
    data/           # Supabase client + queries
    components/
  scripts/          # import-npr.ts, export.ts, keep-alive.ts
  supabase/
    migrations/
    seed.sql
  tests/
    integration/
    e2e/
    fixtures/
  .github/workflows/
  docs/plans/
```

## 9. Scope

**In v1:** everything above.

**Explicitly not in v1** (schema allows them later; no code now): other lists
and cross-list book matching; rereads; rating/date/reviewer filters; tag
AND/OR toggle; stats/history views; multi-user; notes/reviews; offline; import
or export with Goodreads/StoryGraph; custom tags/shelves.

## 10. Future features backlog

- **OR/AND filters** — let tag (and possibly other) filters combine with OR
  as well as AND.
- **Library hold status + read format** — a status for "reserved in
  Libby/library"; when Read, record format (audio / ebook / physical).
  Schema impact: new `book_status` enum value; new nullable format column on
  `book_statuses` (or on a reads table if rereads land first).
- **Per-book notes** — free-form personal notes on each book.
- **Stats** — graphs/charts of what's been read: types of books (tags),
  reading over time, etc. Relies on `date_read` and tags; SQL views are the
  likely backing.
