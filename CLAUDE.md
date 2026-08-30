# Bookshelf — API & data-flow memory

Next.js 15 (App Router) + TypeScript PWA. All third-party book APIs are called
**server-side only** (Next route handlers under `app/api/*`); the browser only ever
talks to our own routes plus Supabase.

---

## 1. External APIs used

| API | Auth | Called from | What we pull |
|---|---|---|---|
| **Google Books** `https://www.googleapis.com/books/v1/volumes` | optional key `GOOGLE_BOOKS_API_KEY` (server-secret; legacy fallback `NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY`), built in `lib/gbUrl.ts` | `api/books/search`, `api/books/metadata`, `api/books/cover`, `api/book-data`, `api/isbn`, `lib/dnbIsbn.ts` | title, subtitle, authors, description, pageCount, publishedDate, publisher, categories (→ subjects/genre), imageLinks (cover), industryIdentifiers (ISBN-10/13) |
| **Open Library** `openlibrary.org/search.json`, `/isbn/{isbn}.json`, `/works/{key}.json` | none (UA header `BookshelfApp/1.0`) | `api/books/search`, `api/books/metadata`, `api/books/cover`, `api/book-data` | title, author_name, cover_i / cover_edition_key, isbn, first_publish_year, publisher, number_of_pages(_median), subject(s), work description |
| **Open Library Covers CDN** `covers.openlibrary.org/b/{id,olid,isbn}/…-{S,M,L}.jpg` | none | cover URL construction + `api/cover` proxy | cover images (`?default=false` so missing covers 404 instead of returning a blank 1×1 GIF) |
| **Deutsche Nationalbibliothek (DNB) SRU** `https://services.dnb.de/sru/dnb` | none | `api/search` (title, MARC21-xml), `api/isbn` + `lib/dnbIsbn.ts` (ISBN, oai_dc) | title (245a / dc:title), author (100a/700a / dc:creator), ISBN-13 (020a), publisher, year. **No covers** — cover is then looked up on Google Books by title+author. Exists because German/Austrian/Swiss books are largely missing from GB/OL |
| **Supabase** (`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY`; server routes and scripts may use `SUPABASE_SERVICE_ROLE_KEY`) | anon key / RLS | `lib/supabase.ts` (browser, via the `/_supabase/*` rewrite in `next.config.js`), `lib/bookApi.ts`, `lib/coverUpload.ts`, `contexts/AppContext.tsx`, server routes | Auth (session, sign-in/up, password reset, user_metadata `display_name` + `avatar_seed`, `rpc('delete_user')`), `books` table CRUD, `book_metadata_cache`, Storage bucket for user-uploaded covers |

No other network services: avatars are generated locally (`lib/avatar.ts`, deterministic
gradient + initials — no network), translations are bundled (`lib/translations.ts`).

Shared server plumbing: `lib/serverFetch.ts` (6 s per-attempt timeout + 1 retry on
network/429/5xx), `lib/rateLimit.ts` (in-process sliding window, per client IP).
CSP in `next.config.js` allows `connect-src 'self' https://*.supabase.co` and
`img-src 'self' data: blob:` only — every external image goes through `/api/cover`.

---

## 2. Our own API routes (what each returns, who calls it)

| Route | Rate limit | Upstreams / order | Response | Client callers |
|---|---|---|---|---|
| `GET /api/books/search?q=&page=` | 40/min | **text**: Google Books free-text (relevance spine) ∥ Open Library free-text, dedup preserving order, paginated (page 1 = 15, then 20). **`isbn:` query**: Supabase `book_metadata_cache` → OL ∥ GB across ISBN-13+ISBN-10 forms → DNB last resort → upsert cache | `{ results: BookMetadata[], hasMore }` | `lib/bookSearch.ts` (`searchBooksPage`, `searchBooks`), `lib/bookMetadata.ts` (`fetchBookByISBN`) |
| `GET /api/search?q=` | 20/min | DNB SRU MARC21-xml (8 records) + cover per ISBN via GB ∥ OL | `{ results: [{title, author, isbn?, cover_url?}] }` | `lib/bookSearch.ts` — merged into page 1 of search only |
| `GET /api/isbn?isbn=` | 30/min | Google Books (both ISBN forms) → DNB (`lib/dnbIsbn.ts`, + GB cover by title+author) | `{ result: IsbnResult \| null }` | `lib/bookMetadata.ts` fallback when `/api/books/search` returns nothing |
| `GET /api/books/metadata?isbn=` | 20/min | Supabase cache (90-day TTL) → OL edition ∥ GB → OL work (description/subjects) → OL search (author names) → upsert cache (incl. `raw_ol`/`raw_gb`) | `{ result: BookMetadata }` | `lib/bookMetadata.ts` (`fetchFullMetadata`) |
| `GET /api/books/cover?title=&author=` | 30/min | GB `intitle:/inauthor:` ∥ OL search; **author required** (title-only returned wrong books) | `{ coverUrl: string \| null }` | `lib/bookMetadata.ts` `fetchCoverByTitleAuthor` → `BookCard`, detail pages (cover self-heal) |
| `GET /api/book-data?title=&author=` | 30/min | GB (description/categories/publishedDate) → OL fallback | `{ description?, genre?, publishedYear? }` | `lib/bookDescription.ts` → to-read + wishlist detail pages |
| `GET /api/cover?url=` | 120/min | Image proxy; host allowlist `books.google.com`, `covers.openlibrary.org`, `*.supabase.co`; https only; OL `-L` → `-M` retry; bodies < 500 B treated as 404 | image bytes, `Cache-Control: 7 days` | every cover render via `lib/coverUrl.ts` (`coverUrl`, `heroCoverUrl`) / `components/BookCover.tsx` |
| `GET /api/version` | — | reads `.next/BUILD_ID` | `{ buildId }` | `components/NewVersionBanner.tsx` polls to prompt reload |

---

## 3. Where the pulled information ends up

**Types**: `types/book.ts` — `BookMetadata` (API shape) and `Book` (a row of the Supabase `books` table).

- **Add flow** (`app/add/page.tsx`, `components/BookForm.tsx`, `components/ToReadForm.tsx`):
  live search suggestions (title, author, cover, ISBN, description, pages, published date,
  publisher, subjects). Picking one auto-fills the form.
- **Barcode scan** (`components/ISBNScanner.tsx`, `@zxing/browser`): scanned ISBN →
  `fetchBookByISBN` → same suggestion shape as search.
- **Persisted on the `books` row** by `lib/bookEnrichment.ts` at save time:
  `isbn13, page_count, published_date, publisher, subjects (max 8), genre (first
  non-generic subject), description (min 30 chars)`, plus `title/author/cover_url`.
  Enrichment is only attached when the suggestion still matches the (possibly hand-edited)
  title+author, and never overwrites existing values.
- **Book detail page** (`app/book/[id]/page.tsx`): renders stored columns first; if
  `needsMetadataLookup(book)` it does one `searchBooks(title)` lookup, shows
  Released / Genre / Pages / Publisher / "About the book", then writes the patch back so
  the lookup never repeats. To-read (`app/to-read/[id]`) and wishlist (`app/wishlist/[id]`)
  pages use `fetchBookData` (`/api/book-data`) for synopsis/genre/year.
- **Covers**: stored `cover_url` (external or user-uploaded to Supabase Storage via
  `lib/coverUpload.ts`) is always rendered through `/api/cover`; `heroImageUrl` upgrades
  GB (`zoom=0&fife=w1200`) and OL (`-L`) resolution. On load failure `BookCard` self-heals
  via `/api/books/cover` and persists the new URL.
- **Dashboard / stats** (`app/page.tsx` + `GenreBreakdown`, `FormatBreakdown`,
  `FavouriteAuthors`, `RatingDistributionChart`, `ReadingPaceChart`): built purely from
  stored `books` columns (`genre`, `author`, `rating`, read dates, `is_audiobook`/`is_ebook`).
- **Caching**: `book_metadata_cache` (Supabase, ISBN-13 PK, public read/write RLS,
  `raw_ol`/`raw_gb` blobs) + Next.js data cache (`revalidate` 1 h–7 d) + CDN
  `s-maxage`/`stale-while-revalidate` headers.
- **Local (no API)**: `localStorage` keys `bookshelf_view_mode`, `bookshelf_cozy_mode`,
  `bookshelf_theme`, `bookshelf_language`, `bookshelf_closed_years`,
  `bookshelf_name_prompted`; user display name/avatar seed live in Supabase `user_metadata`.
- **Admin scripts** (service-role key, not part of the app): `scripts/backfill-book-metadata.mjs`,
  `scripts/refetch-covers.mjs`, `scripts/clear-autofetched-covers.mjs`.
