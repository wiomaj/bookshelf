-- Add a status column to distinguish read books from the "to read" list.
-- Existing rows default to 'read' so no data is affected.
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'read'
  CHECK (status IN ('read', 'to_read'));
