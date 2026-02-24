/**
 * Fetches a book's back-cover synopsis and genre from public APIs.
 * Tries Google Books first (fastest, richest data), then Open Library.
 */
export type BookData = {
  description?: string
  genre?: string
  publishedYear?: string
}

export async function fetchBookData(
  title: string,
  author: string
): Promise<BookData> {
  // ── Google Books ────────────────────────────────────────────────────────────
  try {
    const q = author
      ? `intitle:"${title}" inauthor:"${author}"`
      : `intitle:"${title}"`
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`
    )
    if (res.ok) {
      const data = await res.json()
      for (const item of data.items ?? []) {
        const info = item.volumeInfo ?? {}
        const desc: string | undefined = info.description
        const cats: string[] | undefined = info.categories
        const published: string | undefined = info.publishedDate
        const result: BookData = {}
        if (desc && desc.length > 30) result.description = stripHtml(desc)
        if (cats?.length) result.genre = cats[0].split(' / ')[0].trim()
        if (published) result.publishedYear = published.slice(0, 4)
        if (result.description || result.genre || result.publishedYear) return result
      }
    }
  } catch {
    // fall through to Open Library
  }

  // ── Open Library ────────────────────────────────────────────────────────────
  try {
    const params = new URLSearchParams({
      title,
      ...(author ? { author } : {}),
      fields: 'key,subject',
      limit: '1',
    })
    const searchRes = await fetch(`https://openlibrary.org/search.json?${params}`)
    if (searchRes.ok) {
      const searchData = await searchRes.json()
      const doc = searchData.docs?.[0]
      const key: string | undefined = doc?.key
      const result: BookData = {}

      // Genre from subject tags
      if (doc?.subject?.length) {
        result.genre = doc.subject[0]
      }

      // Description from work record
      if (key) {
        const workRes = await fetch(`https://openlibrary.org${key}.json`)
        if (workRes.ok) {
          const work = await workRes.json()
          const desc = work.description
          if (typeof desc === 'string' && desc.length > 30) result.description = stripHtml(desc)
          else if (typeof desc?.value === 'string' && desc.value.length > 30) result.description = stripHtml(desc.value)
        }
      }

      if (result.description || result.genre) return result
    }
  } catch {
    // ignore
  }

  return {}
}

/** Strip basic HTML tags that Google Books sometimes includes in descriptions. */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}
