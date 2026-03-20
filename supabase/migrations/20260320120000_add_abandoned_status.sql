-- Add 'abandoned' as a valid book status for books the user started but stopped reading.
-- Drop the old check constraint and create a new one that includes 'abandoned'.
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_status_check;
ALTER TABLE books ADD CONSTRAINT books_status_check CHECK (status IN ('read', 'to_read', 'wishlist', 'abandoned'));
