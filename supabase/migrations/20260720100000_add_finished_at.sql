-- Track the exact moment a book is marked as finished. The read list sorts by
-- year, then month, but within the same month it previously fell back to
-- created_at — the time the row was first added (e.g. to the to-read list),
-- which can be months before the book was actually finished. finished_at
-- records the real finish order; existing rows stay NULL and the app falls
-- back to created_at for them (and backfills finished_at on the next edit).
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
