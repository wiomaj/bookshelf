export type BookData = {
  description?: string
  genre?: string
  publishedYear?: string
}

export async function fetchBookData(
  title: string,
  author: string
): Promise<BookData> {
  try {
    const params = new URLSearchParams({ title, ...(author ? { author } : {}) })
    const res = await fetch(`/api/book-data?${params}`)
    if (res.ok) return await res.json()
  } catch {
    // ignore
  }
  return {}
}
