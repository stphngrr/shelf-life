-- ABOUTME: Creates the book catalog: source lists, books, and each book's entries on a list.
-- ABOUTME: Catalog rows are written only by the import script; user data lives elsewhere.

-- A source list of books, such as NPR's Books We Love.
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  source_url text not null
);

-- A book as a work, independent of which lists it appears on.
create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  isbn10 text,
  isbn13 text,
  cover_url text
);

-- A book's appearance on a list, carrying that list's own metadata.
create table public.list_entries (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id),
  book_id uuid not null references public.books (id),
  -- The list's natural key for this entry; for NPR, "{year}:{id}".
  source_key text not null,
  year smallint not null,
  edition text,
  tags text[] not null default '{}',
  blurb_html text,
  reviewers text[] not null default '{}',
  external_links jsonb not null default '{}',
  -- Set when the entry disappears from the source list; entries are never deleted.
  removed_from_source_at timestamptz,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (list_id, source_key)
);

create index list_entries_book_id_idx on public.list_entries (book_id);
create index list_entries_year_idx on public.list_entries (year);

-- Keeps updated_at current on every row update.
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger list_entries_set_updated_at
  before update on public.list_entries
  for each row execute function public.set_updated_at();
