create table if not exists book_metadata_cache (
  isbn13         text primary key,
  title          text not null,
  authors        text[],
  description    text,
  page_count     integer,
  published_date text,
  publisher      text,
  subjects       text[],
  cover_url      text,
  source         text,
  fetched_at     timestamptz default now(),
  raw_ol         jsonb,
  raw_gb         jsonb
);

create index if not exists book_metadata_cache_title_idx
  on book_metadata_cache (lower(title));

alter table book_metadata_cache enable row level security;

-- Anyone (including anonymous) can read cached book metadata
create policy "book_metadata_cache_read"
  on book_metadata_cache for select using (true);

-- Server-side API routes write using the anon key — allow inserts from any session
-- since this is entirely public book metadata (not user data)
create policy "book_metadata_cache_insert"
  on book_metadata_cache for insert with check (true);

create policy "book_metadata_cache_update"
  on book_metadata_cache for update using (true);
