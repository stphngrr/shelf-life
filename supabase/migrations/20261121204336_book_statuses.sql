-- ABOUTME: Creates each user's reading status for a book: want to read, read, or dismissed.
-- ABOUTME: A book with no status row is unmarked; read statuses may carry a date and rating.

create type public.book_status as enum ('want_to_read', 'read', 'dismissed');

create table public.book_statuses (
  user_id uuid not null references auth.users (id) on delete cascade,
  book_id uuid not null references public.books (id),
  status public.book_status not null,
  date_read date,
  -- Rating in quarter stars: 0–20 maps to 0–5 stars; null means not rated.
  rating_quarters smallint check (rating_quarters between 0 and 20),
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id),
  constraint read_details_only_when_read
    check (status = 'read' or (date_read is null and rating_quarters is null))
);

create index book_statuses_book_id_idx on public.book_statuses (book_id);

create trigger book_statuses_set_updated_at
  before update on public.book_statuses
  for each row execute function public.set_updated_at();
