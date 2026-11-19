# shelf-life — Implementation Plan

Date: 2026-11-19
Spec: [2026-11-19-shelf-life-design.md](2026-11-19-shelf-life-design.md)
Goal: Phases 0–6 done before NPR publishes 2026 (expected ~week of 2026-11-23),
so the 2026 import is just a re-run.

Conventions for every step:
- TDD: failing test → run, confirm failure → minimal code → run, confirm pass →
  refactor green.
- Every code file starts with two `ABOUTME:` comment lines.
- Co-located unit/component tests (`foo.ts` + `foo.test.ts`).
- Commit at the end of each step (more often is fine). Never skip hooks.
- Test output pristine; intentional errors captured and asserted.

---

## Phase 0 — Repo and tooling

0.1 `git init`, WIP branch, commit docs. Create GitHub repos: public
    `stphngrr/shelf-life`, private `stphngrr/shelf-life-data`.
0.2 Install OrbStack and Supabase CLI (`brew install orbstack supabase/tap/supabase`);
    verify `docker info` and `supabase --version`. (Needs Stephanie for the
    OrbStack first-launch prompt.)
0.3 Scaffold Vite React-TS app; add Vitest + React Testing Library + jsdom,
    `/// <reference types="vitest/config" />` in `vite.config.ts`; strict
    tsconfig matching agony-ops (`erasableSyntaxOnly` etc.). Scripts:
    `dev`, `build`, `typecheck`, `test`, `test:integration`, `test:e2e`,
    `import:npr`. One trivial passing test to prove the harness.
0.4 `supabase init`; `supabase start`; `.env.local` (gitignored) with local
    URL/keys; `.env.example` committed. Verify a script can connect.

## Phase 1 — Database

1.1 Integration test harness: `tests/integration/` helper that connects with
    service-role and anon clients to local Supabase, creates test users via
    the admin API, and resets data between suites. Separate Vitest config
    (`vitest.integration.config.ts`, node environment).
1.2 Migration: `lists`, `books`, `list_entries` (+ unique
    `(list_id, source_key)`, indexes on `book_id`, `year`). Tests: insert/read
    via service role; uniqueness enforced.
1.3 Migration: `book_status` enum + `book_statuses` with rating range CHECK and
    read-only-fields CHECK. Tests: each constraint rejects bad rows, accepts
    good ones (0, 20, NULL rating; date only when read).
1.4 Migration: RLS. Tests: anon reads nothing from any table; authenticated
    reads catalog but can't write it; user A can't see/modify user B's
    statuses; user can CRUD own statuses.
1.5 Seed `lists` row for `npr-books-we-love` (migration, since it's reference
    data the import depends on). Disable signups in `supabase/config.toml`.

## Phase 2 — NPR import

2.1 Fixture: save a real slice of `shelf.json` to
    `tests/fixtures/npr-shelf-sample.json` (~20 records across several years,
    including: `Fall` vs `fall` edition, missing ISBN, curly-apostrophe tags,
    story links, empty itunes).
2.2 `scripts/npr/validate.ts` — runtime shape check of raw records (`unknown`
    in, typed record or descriptive error out). Unit tests incl. malformed.
2.3 `scripts/npr/normalize.ts` — raw record → `{ book, entry }` rows. Unit
    tests for every normalization rule in spec §6.
2.4 `scripts/npr/import.ts` — transactional upsert + removal flagging +
    summary. Integration tests against local Supabase: first run inserts all;
    re-run reports all unchanged and changes nothing; fixture with one record
    removed flags it; re-adding clears flag; statuses untouched throughout.
    Implementation likely a Postgres function (RPC) taking a jsonb batch so
    the whole import is one transaction — confirm while writing tests.
2.5 `scripts/import-npr.ts` CLI: fetch (gzip), validate, import, print
    summary; non-zero exit on failure. Test fetch-failure path writes nothing.
2.6 Run a real import into local Supabase; sanity-check counts (4,371).

## Phase 3 — Pure logic and data layer

3.1 `src/lib/rating.ts` — quarters ↔ stars, formatting, clamping/validation.
3.2 `src/lib/filters.ts` — `matchesFilters(book, filters)`: years OR, tags
    AND, status set (unmarked as a status), case-insensitive title/author
    search. Default filters.
3.3 `src/lib/urlState.ts` — encode/decode filters to/from hash; round-trip
    tests; unknown/garbage params ignored.
3.4 `src/lib/statusTransitions.ts` — given current status + action, the next
    status row (or delete) and whether confirmation is needed (leaving Read
    with date/rating).
3.5 `src/data/client.ts` + `src/data/catalog.ts` — load list fields for all
    entries joined to books and the user's statuses; fetch blurb by entry id.
    Integration tests against local Supabase.
3.6 `src/data/statuses.ts` — upsert/delete status. Integration tests.
3.7 Backend-paused detection: classify Supabase errors into
    `paused/unreachable` vs other. Unit tests on real error shapes.

## Phase 4 — UI

4.1 App shell + auth: login screen (magic link), session handling, sign out.
    Component tests.
4.2 `useCatalog` hook: loads catalog once, exposes books + statuses; handles
    paused backend state. Tests.
4.3 `useBookStatus` / optimistic update with rollback + error surface. Tests.
4.4 Filter bar (years, tags, status, search, count, clear) wired to URL state.
4.5 Grid view with status badges and quick-mark buttons.
4.6 List view; view toggle persisted to localStorage (try/catch).
4.7 Detail panel: metadata, lazy blurb, links, status controls, date picker,
    rating input (0–5, 0.25 steps) with star rendering, removed-from-NPR note,
    confirm when leaving Read.
4.8 Responsive pass (phone width, no horizontal scroll); accessibility pass
    (keyboard, labels, focus in panel).

## Phase 5 — End-to-end

5.1 Playwright setup against dev server + local Supabase; magic-link login in
    tests via local Inbucket/Mailpit mail catcher (real flow, no mocks).
5.2 E2E: login → filter → quick-mark want → open detail → mark read with date
    + 3.75★ → reload → persisted; dismiss hides by default; URL filters
    survive reload.

## Phase 6 — Production

6.1 Create Supabase project (Stephanie, in dashboard; free tier). Link CLI,
    `supabase db push` migrations. Disable signups; configure magic-link
    redirect URL to the Pages URL. Create Stephanie's user.
6.2 Configure Vite `base` for `/shelf-life/`; production env via build-time
    vars (URL + anon key only).
6.3 `deploy.yml`: typecheck, unit/component tests, build, deploy to Pages.
    Enable Pages (Actions source).
6.4 Add GitHub secrets; run first production import locally or via
    `import.yml` dispatch.
6.5 Smoke test on phone + desktop.

## Phase 7 — Scheduled workflows

7.1 `scripts/keep-alive.ts` + `keep-alive.yml` (daily): authenticated query;
    fail loudly; heartbeat commit to `heartbeat.txt` if last commit >30 days
    old. Unit test the "needs heartbeat" date logic.
7.2 `import.yml` (weekly + `workflow_dispatch`).
7.3 `scripts/export.ts` + `export.yml` (weekly): dated JSON of statuses
    joined with title/author/ISBNs, committed to `shelf-life-data` via
    fine-grained token/deploy key. Integration test the export query/shape.
7.4 Verify each workflow with a manual dispatch.

## Phase 8 — 2026 list

8.1 When NPR publishes 2026: run `import.yml`; confirm counts, tags (new tags?),
    editions, covers. Adjust normalization if NPR changed the format (TDD).

---

## Open items / risks

- `shelf.json` may lag per-year files when 2026 launches; fall back to
  `2026-detail.json` if needed (decide then, with a test).
- GitHub Pages + magic-link redirect with hash routing — verify in 6.1.
- Keep-alive needs an authenticated query or a lightweight anon-safe RPC;
  decide in 7.1 (anon can read nothing by design).
