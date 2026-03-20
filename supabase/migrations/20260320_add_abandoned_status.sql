-- Allow 'abandoned' as a valid book status.
-- Drop the old check constraint and recreate it with the new value.
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE books ADD CONSTRAINT books_status_check CHECK (status IN ('read', 'to_read', 'wishlist', 'abandoned'));
