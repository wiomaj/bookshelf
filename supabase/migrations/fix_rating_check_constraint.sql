-- Allow rating = 0 (meaning "not yet rated") for books on the To Read list.
-- Previously the constraint only allowed 1–5.
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_rating_check;
ALTER TABLE books ADD CONSTRAINT books_rating_check
  CHECK (rating >= 0 AND rating <= 5);
