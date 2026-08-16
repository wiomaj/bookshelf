-- Content metadata for books.
--
-- /api/books/search already returns isbn13, subjects, page count, publisher and
-- published date for every result, but the add flow only ever persisted the
-- title, author and cover. Everything else was re-fetched on each detail-page
-- view and thrown away again — slow, and lossy, because the upstream
-- catalogues resolve the same title to a different edition over time.
--
-- isbn13 is the join key into book_metadata_cache; subjects and page_count are
-- the content and length signals a recommendation feature has to reason over.

alter table books
  add column if not exists isbn13         text,
  add column if not exists page_count     integer,
  add column if not exists published_date text,
  add column if not exists publisher      text,
  add column if not exists subjects       text[];

-- Lookups are always scoped to one user (RLS), so the user column leads.
-- Partial: rows without an ISBN are never looked up this way.
create index if not exists books_user_isbn13_idx
  on books (user_id, isbn13)
  where isbn13 is not null;
