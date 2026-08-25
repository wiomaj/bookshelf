-- Synopsis text for books.
--
-- Completes the previous migration: the detail pages fetched a description from
-- Google Books on every single view purely to render "About the book". Storing
-- it alongside the other content metadata removes that request entirely for
-- books added since, and makes the text stable — the catalogue lookup resolves
-- to whichever edition ranks first that day, so the synopsis could change
-- between two visits to the same book.
--
-- Deliberately NOT added to the list query in lib/bookApi: descriptions run to
-- a few KB each and the home screen loads every book at once. Only getBook and
-- the insert/update round-trips select this column.

alter table books
  add column if not exists description text;
