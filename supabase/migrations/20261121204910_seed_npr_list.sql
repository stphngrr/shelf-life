-- ABOUTME: Seeds the NPR Books We Love list, which the NPR import script attaches entries to.
-- ABOUTME: Reference data lives in a migration so every environment has it.

insert into public.lists (slug, name, source_url)
values ('npr-books-we-love', 'NPR Books We Love', 'https://apps.npr.org/best-books/');
