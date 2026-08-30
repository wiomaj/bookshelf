/**
 * lib/bookSeries.ts
 *
 * Parsing and grouping of book series ("Band 3 von Die Tribute von Panem").
 *
 * No catalogue exposes a series as clean structured data across the board, so
 * everything here works on free text and every source funnels through the same
 * two functions:
 *
 *   - Open Library editions carry `series: string[]` — free text, usually
 *     "Harry Potter #3", sometimes split as ["The Lord of the Rings", "Part 1"].
 *   - DNB MARC 490/830 carries title and volume in separate subfields, which
 *     callers join into the same "<title>, Bd. <n>" shape.
 *   - Google Books gives a position (`seriesInfo.bookDisplayNumber`) but no
 *     series name, so the name has to come out of the title's trailing
 *     parenthetical — "Mistborn: The Final Empire (Mistborn, #1)".
 *
 * Nothing here does I/O: the matching rules are the part that has to be right,
 * and they are cheaper to get right against a table of real-world strings than
 * against a live API.
 */

/** A series membership: the series name plus the volume's position in it. */
export type SeriesInfo = {
  /** Display name, cleaned of volume markers — "Die Tribute von Panem". */
  series: string
  /**
   * Position within the series. Fractional on purpose: genre series routinely
   * number novellas 2.5, and rounding them onto 2 or 3 would sort them onto
   * a full-length volume.
   */
  index: number | null
}

/**
 * Volume markers, in the four languages that actually show up in the
 * catalogues for this app's audience. `bd` covers the DNB abbreviation, which
 * appears both as "Bd." and bare.
 */
const VOLUME_WORD = '(?:bd|bde|band|vol|volume|book|buch|teil|part|tome|nr|no|number)'

/** Written-out positions. English only — German catalogues number digitally. */
const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

/** Trailing punctuation and whitespace left behind once a marker is removed. */
const TRAILING_JUNK = /[\s,;:.\-–—/|]+$/
const LEADING_JUNK = /^[\s,;:.\-–—/|]+/

/**
 * Series names that are shelving labels rather than a reading order. Open
 * Library's `series` field is full of them, and a "Band 4 von Penguin Modern
 * Classics" chip would be nonsense. Matched as whole words against the
 * normalised name.
 */
const PUBLISHER_SERIES = [
  'penguin classics',
  'penguin modern classics',
  'modern library',
  'everyman s library',
  'oxford world s classics',
  'vintage classics',
  'reclams universal bibliothek',
  'reclam universal bibliothek',
  'rororo',
  'insel taschenbuch',
  'suhrkamp taschenbuch',
  'dtv',
]

/** Parse "3", "3.5", "03", "3,5" or "three" into a number. Null when unparseable. */
function parseIndex(raw: string): number | null {
  const token = raw.trim().toLowerCase()
  if (!token) return null

  const word = WORD_NUMBERS[token]
  if (word !== undefined) return word

  // "3,5" is the German decimal form; "1,234" as a thousands separator does not
  // occur in volume numbers, so a comma is always a decimal point here.
  const numeric = token.replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(numeric)) return null

  const value = parseFloat(numeric)
  return Number.isFinite(value) ? value : null
}

function trim(value: string): string {
  return value.replace(LEADING_JUNK, '').replace(TRAILING_JUNK, '').trim()
}

/**
 * Split a free-text series string into name and volume.
 *
 * Handles, in order of how often the catalogues produce them:
 *   "Harry Potter #3"          "Discworld, #5"        "Mistborn #3.5"
 *   "Die Tribute von Panem, Bd. 2"                    "Der dunkle Turm Band 3"
 *   "The Wheel of Time, Book Four"                    "Millennium 1"
 *
 * A name with no recognisable volume marker still returns, with a null index —
 * "Discworld" alone is a real and useful grouping. A string that is *only* a
 * volume marker ("#3", "Band 2") returns null: there is no series to name.
 */
export function parseSeriesString(
  raw: string | null | undefined,
  options: { allowBareNumber?: boolean } = {},
): SeriesInfo | null {
  if (!raw) return null

  const input = trim(String(raw).replace(/\s+/g, ' '))
  if (!input) return null

  // 1. Explicit marker: "#3", "Bd. 2", "Book Four", "Vol 7".
  const marked = new RegExp(
    `^(.*?)[\\s,;:.\\-–—]*(?:#|\\b${VOLUME_WORD}\\b\\.?)\\s*([\\w.,]+)$`,
    'i',
  ).exec(input)

  if (marked) {
    const index = parseIndex(marked[2])
    if (index !== null) {
      const name = trim(marked[1])
      // "#3" on its own names no series.
      return name ? { series: name, index } : null
    }
  }

  // 2. Bare trailing number: "Millennium 1".
  //
  //    OFF by default, and deliberately so. There is no way to tell "Millennium
  //    1" (volume) from "Fahrenheit 451", "Catch 22" or "Das Boot 2" (the
  //    number is the name) from the string alone, and guessing wrong invents a
  //    series called "Fahrenheit" holding a volume 451. Treating an unnumbered
  //    series as unnumbered is the cheap failure; a fabricated volume number
  //    has to be cleaned out of the database by hand.
  //
  //    Enable it only where the caller already knows the string is a series
  //    statement AND the shelf corroborates it — the same name stem appearing
  //    with several different trailing numbers.
  if (options.allowBareNumber) {
    const bare = /^(.*[^\s\d])\s+(\d{1,3}(?:[.,]\d+)?)$/.exec(input)
    if (bare) {
      const index = parseIndex(bare[2])
      const name = trim(bare[1])
      if (index !== null && name && !new RegExp(`^${VOLUME_WORD}$`, 'i').test(name)) {
        return { series: name, index }
      }
    }
  }

  // 3. No volume anywhere — the whole string is the series name.
  const name = trim(input)
  if (!name) return null
  if (new RegExp(`^${VOLUME_WORD}\\b`, 'i').test(name) && /\d/.test(name) === false) return null

  return { series: name, index: null }
}

/**
 * Parse Open Library's `series` array, which is sometimes one combined string
 * and sometimes name and volume as separate entries:
 *
 *   ["Harry Potter #3"]                  → { series: "Harry Potter", index: 3 }
 *   ["The Lord of the Rings", "Part 1"]  → { series: "The Lord of the Rings", index: 1 }
 */
export function parseSeriesArray(entries: unknown): SeriesInfo | null {
  if (!Array.isArray(entries) || entries.length === 0) return null

  const strings = entries.filter((e): e is string => typeof e === 'string' && e.trim() !== '')
  if (strings.length === 0) return null

  const first = parseSeriesString(strings[0])
  if (!first) return null
  if (first.index !== null || strings.length === 1) return first

  // The name came back without a volume — look for one in the later entries.
  for (const rest of strings.slice(1)) {
    const parsed = parseSeriesString(rest)
    // A follow-up entry that is only a volume marker parses to null, so read the
    // number straight out of it.
    const index = parsed?.index ?? parseIndex(rest.replace(new RegExp(`^(?:#|\\b${VOLUME_WORD}\\b\\.?)\\s*`, 'i'), ''))
    if (index !== null) return { series: first.series, index }
  }

  return first
}

/**
 * Pull a series out of a title's trailing parenthetical — the only series
 * signal Google Books reliably carries, since its `seriesInfo` gives an opaque
 * id instead of a name.
 *
 *   "Mistborn: The Final Empire (Mistborn, #1)" → { series: "Mistborn", index: 1 }
 *   "Der Herr der Ringe (Band 1)"               → null — no series named
 *
 * Requires a volume number: a bare parenthetical is far more often an edition
 * note ("(Illustrated)", "(Movie Tie-In)") than a series, and guessing wrong
 * fabricates series that would then need cleaning out of the database by hand.
 */
export function seriesFromTitle(title: string | null | undefined): SeriesInfo | null {
  if (!title) return null

  const paren = /\(([^()]+)\)\s*$/.exec(title.trim())
  if (!paren) return null

  const parsed = parseSeriesString(paren[1])
  if (!parsed || parsed.index === null) return null

  // "(Book 3)" names a volume but no series.
  return parsed
}

/**
 * Normalise a series name into a grouping key.
 *
 * The catalogues spell the same series several ways across editions — "Harry
 * Potter", "Harry Potter Series", "The Harry Potter" — and without collapsing
 * those a shelf shows one series three times. Diacritics are folded so a German
 * and an English edition of the same series still meet.
 */
export function seriesKey(name: string | null | undefined): string {
  if (!name) return ''

  let key = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // strip combining accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')       // punctuation → separator
    .trim()

  // Leading article, in the five UI languages.
  key = key.replace(/^(?:the|a|an|der|die|das|le|la|les|el|los|las)\s+/, '')

  // Trailing genre noise that editions add inconsistently. "trilogy" and
  // "saga" are deliberately NOT stripped — they distinguish real series
  // ("The Foundation Trilogy" vs "Foundation").
  key = key.replace(/\s+(?:series|reihe|novels?|romane?|cycle|zyklus)$/, '')

  return key.replace(/\s+/g, ' ').trim()
}

/**
 * True when a series name is a publisher's imprint rather than a reading
 * order. Callers should store these as a plain label at most — never as a
 * numbered "Band 4 von …".
 */
export function isPublisherSeries(name: string | null | undefined): boolean {
  const key = seriesKey(name)
  if (!key) return false
  return PUBLISHER_SERIES.some((p) => key === p || key.startsWith(`${p} `))
}

/**
 * Resolve a series from every signal a search result carries, best source
 * first: an explicit catalogue field beats a name parsed out of the title.
 *
 * `googleIndex` is Google Books' `seriesInfo.bookDisplayNumber` — a position
 * without a name, so it can only fill a gap in a series found elsewhere.
 */
export function resolveSeries(input: {
  openLibrarySeries?: unknown
  dnbSeries?: string | null
  title?: string | null
  googleIndex?: string | number | null
}): SeriesInfo | null {
  const resolved =
    parseSeriesArray(input.openLibrarySeries) ??
    parseSeriesString(input.dnbSeries) ??
    seriesFromTitle(input.title)

  if (!resolved) return null
  if (isPublisherSeries(resolved.series)) return null

  if (resolved.index === null && input.googleIndex != null) {
    const index = parseIndex(String(input.googleIndex))
    if (index !== null) return { series: resolved.series, index }
  }

  return resolved
}

/**
 * Group books by series key, dropping anything without one.
 *
 * Volumes sort by index, with unnumbered volumes last — an unknown position is
 * far more often a companion or a short story than volume zero. The display
 * name is taken from the longest spelling seen, which is the one that still
 * reads correctly when the others are abbreviations.
 */
export function groupBySeries<T extends { series?: string | null; series_index?: number | null }>(
  books: T[],
): Array<{ key: string; series: string; books: T[] }> {
  const groups = new Map<string, { key: string; series: string; books: T[] }>()

  for (const book of books) {
    const key = seriesKey(book.series)
    if (!key) continue

    const existing = groups.get(key)
    if (existing) {
      existing.books.push(book)
      if ((book.series ?? '').length > existing.series.length) {
        existing.series = book.series as string
      }
    } else {
      groups.set(key, { key, series: book.series as string, books: [book] })
    }
  }

  for (const group of groups.values()) {
    group.books.sort((a, b) => {
      const ai = a.series_index ?? Number.POSITIVE_INFINITY
      const bi = b.series_index ?? Number.POSITIVE_INFINITY
      return ai - bi
    })
  }

  return Array.from(groups.values()).sort((a, b) => a.series.localeCompare(b.series))
}

/**
 * The volume numbers missing from a series you own, e.g. [3] when the shelf
 * holds 1, 2 and 4 — the "du hast Band 3 nicht" hint.
 *
 * Derived purely from the numbers present, so it can only ever report gaps
 * *inside* what you own; it cannot know a series runs to seven volumes when
 * you stop at four. Fractional volumes are ignored: a missing 2.5 novella is
 * not a gap in the main sequence.
 */
export function missingVolumes(indices: Array<number | null | undefined>): number[] {
  const whole = indices
    .filter((i): i is number => typeof i === 'number' && Number.isInteger(i) && i > 0)
    .sort((a, b) => a - b)

  if (whole.length < 2) return []

  const present = new Set(whole)
  const gaps: number[] = []
  for (let i = whole[0]; i < whole[whole.length - 1]; i++) {
    if (!present.has(i)) gaps.push(i)
  }
  return gaps
}
