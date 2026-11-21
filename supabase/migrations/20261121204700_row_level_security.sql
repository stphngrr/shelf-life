-- ABOUTME: Enables Row Level Security on every public table.
-- ABOUTME: Signed-in users read the catalog and manage only their own statuses; anonymous users see nothing.

alter table public.lists enable row level security;
alter table public.books enable row level security;
alter table public.list_entries enable row level security;
alter table public.book_statuses enable row level security;

-- The catalog is read-only through the API; the import script writes it with the secret key.
create policy "Signed-in users can read lists"
  on public.lists for select to authenticated
  using (true);

create policy "Signed-in users can read books"
  on public.books for select to authenticated
  using (true);

create policy "Signed-in users can read list entries"
  on public.list_entries for select to authenticated
  using (true);

-- `(select auth.uid())` is evaluated once per statement rather than once per row.
create policy "Users can read their own statuses"
  on public.book_statuses for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own statuses"
  on public.book_statuses for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own statuses"
  on public.book_statuses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own statuses"
  on public.book_statuses for delete to authenticated
  using ((select auth.uid()) = user_id);
