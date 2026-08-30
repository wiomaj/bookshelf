import { describe, it, expect } from 'vitest'
import {
  parseSeriesString,
  parseSeriesArray,
  seriesFromTitle,
  seriesKey,
  isPublisherSeries,
  resolveSeries,
  groupBySeries,
  missingVolumes,
} from '../bookSeries'

describe('parseSeriesString', () => {
  it('reads the "#n" form Open Library uses most', () => {
    expect(parseSeriesString('Harry Potter #3')).toEqual({ series: 'Harry Potter', index: 3 })
    expect(parseSeriesString('Discworld, #5')).toEqual({ series: 'Discworld', index: 5 })
  })

  it('reads German volume markers', () => {
    expect(parseSeriesString('Die Tribute von Panem, Bd. 2')).toEqual({
      series: 'Die Tribute von Panem', index: 2,
    })
    expect(parseSeriesString('Der dunkle Turm Band 3')).toEqual({
      series: 'Der dunkle Turm', index: 3,
    })
    expect(parseSeriesString('Das Rad der Zeit, Teil 4')).toEqual({
      series: 'Das Rad der Zeit', index: 4,
    })
  })

  it('reads English volume markers, spelled out or not', () => {
    expect(parseSeriesString('The Wheel of Time, Book 4')).toEqual({
      series: 'The Wheel of Time', index: 4,
    })
    expect(parseSeriesString('The Wheel of Time, Book Four')).toEqual({
      series: 'The Wheel of Time', index: 4,
    })
    expect(parseSeriesString('Discworld Vol. 7')).toEqual({ series: 'Discworld', index: 7 })
  })

  it('keeps fractional volumes apart from the whole ones', () => {
    expect(parseSeriesString('Mistborn #3.5')).toEqual({ series: 'Mistborn', index: 3.5 })
    // German decimal comma
    expect(parseSeriesString('Mistborn, Bd. 3,5')).toEqual({ series: 'Mistborn', index: 3.5 })
  })

  it('does NOT read a bare trailing number by default', () => {
    // "Fahrenheit 451" and "Catch 22" are indistinguishable from "Millennium 1"
    // as strings, so an unmarked number is never read as a volume.
    expect(parseSeriesString('Fahrenheit 451')).toEqual({ series: 'Fahrenheit 451', index: null })
    expect(parseSeriesString('Catch 22')).toEqual({ series: 'Catch 22', index: null })
    expect(parseSeriesString('Apollo 13')).toEqual({ series: 'Apollo 13', index: null })
    expect(parseSeriesString('Millennium 1')).toEqual({ series: 'Millennium 1', index: null })
  })

  it('reads a bare trailing number only when the caller opts in', () => {
    const opts = { allowBareNumber: true }
    expect(parseSeriesString('Millennium 1', opts)).toEqual({ series: 'Millennium', index: 1 })
    expect(parseSeriesString('Sturmlicht-Chroniken 2', opts)).toEqual({
      series: 'Sturmlicht-Chroniken', index: 2,
    })
    // Still refuses a four-digit number, which is a year rather than a volume.
    expect(parseSeriesString('Berlin 1945', opts)).toEqual({ series: 'Berlin 1945', index: null })
  })

  it('keeps a marked volume readable even when the name ends in a number', () => {
    expect(parseSeriesString('Catch 22, Bd. 2')).toEqual({ series: 'Catch 22', index: 2 })
  })

  it('returns the name alone when no volume is given', () => {
    expect(parseSeriesString('Discworld')).toEqual({ series: 'Discworld', index: null })
  })

  it('rejects a volume marker with no series to name', () => {
    expect(parseSeriesString('#3')).toBeNull()
    expect(parseSeriesString('Band 2')).toBeNull()
    expect(parseSeriesString('Book Four')).toBeNull()
  })

  it('handles empty and missing input', () => {
    expect(parseSeriesString('')).toBeNull()
    expect(parseSeriesString('   ')).toBeNull()
    expect(parseSeriesString(null)).toBeNull()
    expect(parseSeriesString(undefined)).toBeNull()
  })

  it('collapses stray whitespace and separators', () => {
    expect(parseSeriesString('  Harry   Potter ,  #3 ')).toEqual({
      series: 'Harry Potter', index: 3,
    })
  })
})

describe('parseSeriesArray', () => {
  it('reads a single combined entry', () => {
    expect(parseSeriesArray(['Harry Potter #3'])).toEqual({ series: 'Harry Potter', index: 3 })
  })

  it('joins a name entry with a separate volume entry', () => {
    expect(parseSeriesArray(['The Lord of the Rings', 'Part 1'])).toEqual({
      series: 'The Lord of the Rings', index: 1,
    })
    expect(parseSeriesArray(['Der Herr der Ringe', 'Bd. 2'])).toEqual({
      series: 'Der Herr der Ringe', index: 2,
    })
  })

  it('keeps the volume from the first entry when it already has one', () => {
    expect(parseSeriesArray(['Discworld #5', 'Part 9'])).toEqual({
      series: 'Discworld', index: 5,
    })
  })

  it('falls back to the name alone when no entry carries a volume', () => {
    expect(parseSeriesArray(['Discworld', 'City Watch'])).toEqual({
      series: 'Discworld', index: null,
    })
  })

  it('ignores non-arrays, empty arrays and non-string entries', () => {
    expect(parseSeriesArray(null)).toBeNull()
    expect(parseSeriesArray([])).toBeNull()
    expect(parseSeriesArray('Harry Potter #3')).toBeNull()
    expect(parseSeriesArray([42, {}])).toBeNull()
  })
})

describe('seriesFromTitle', () => {
  it('reads a trailing parenthetical carrying a volume', () => {
    expect(seriesFromTitle('Mistborn: The Final Empire (Mistborn, #1)')).toEqual({
      series: 'Mistborn', index: 1,
    })
    expect(seriesFromTitle('Guards! Guards! (Discworld Novel #8)')).toEqual({
      series: 'Discworld Novel', index: 8,
    })
  })

  it('ignores an edition note', () => {
    expect(seriesFromTitle('Dune (Illustrated Edition)')).toBeNull()
    expect(seriesFromTitle('It (Movie Tie-In)')).toBeNull()
  })

  it('ignores a parenthetical that names a volume but no series', () => {
    expect(seriesFromTitle('Der Herr der Ringe (Band 1)')).toBeNull()
  })

  it('ignores a title with no parenthetical', () => {
    expect(seriesFromTitle('Dune')).toBeNull()
    expect(seriesFromTitle('')).toBeNull()
    expect(seriesFromTitle(null)).toBeNull()
  })

  it('only reads a parenthetical at the very end', () => {
    expect(seriesFromTitle('A (Mistborn, #1) Story of Something')).toBeNull()
  })
})

describe('seriesKey', () => {
  it('collapses the spellings the catalogues mix', () => {
    expect(seriesKey('Harry Potter')).toBe(seriesKey('The Harry Potter'))
    expect(seriesKey('Harry Potter')).toBe(seriesKey('Harry Potter Series'))
    expect(seriesKey('Harry Potter')).toBe(seriesKey('harry  potter!'))
  })

  it('folds diacritics so editions in different languages meet', () => {
    expect(seriesKey('Die Träume')).toBe(seriesKey('Die Traume'))
  })

  it('strips a leading article in each UI language', () => {
    expect(seriesKey('Der Turm')).toBe('turm')
    expect(seriesKey('Les Miserables')).toBe('miserables')
    expect(seriesKey('El Cid')).toBe('cid')
  })

  it('keeps trilogy and saga, which distinguish real series', () => {
    expect(seriesKey('The Foundation Trilogy')).not.toBe(seriesKey('Foundation'))
  })

  it('returns empty for empty input', () => {
    expect(seriesKey('')).toBe('')
    expect(seriesKey(null)).toBe('')
    expect(seriesKey('!!!')).toBe('')
  })
})

describe('isPublisherSeries', () => {
  it('flags imprints that are not a reading order', () => {
    expect(isPublisherSeries('Penguin Classics')).toBe(true)
    expect(isPublisherSeries('Penguin Modern Classics')).toBe(true)
    expect(isPublisherSeries('rororo')).toBe(true)
  })

  it('does not flag a real series', () => {
    expect(isPublisherSeries('Discworld')).toBe(false)
    expect(isPublisherSeries('Die Tribute von Panem')).toBe(false)
    expect(isPublisherSeries('')).toBe(false)
  })
})

describe('resolveSeries', () => {
  it('prefers the Open Library field over the title', () => {
    expect(resolveSeries({
      openLibrarySeries: ['Discworld #5'],
      title: 'Sourcery (Something Else, #9)',
    })).toEqual({ series: 'Discworld', index: 5 })
  })

  it('falls back to DNB, then to the title', () => {
    expect(resolveSeries({ dnbSeries: 'Die Tribute von Panem, Bd. 2' })).toEqual({
      series: 'Die Tribute von Panem', index: 2,
    })
    expect(resolveSeries({ title: 'Mistborn: The Final Empire (Mistborn, #1)' })).toEqual({
      series: 'Mistborn', index: 1,
    })
  })

  it("fills a missing volume from Google's position", () => {
    expect(resolveSeries({ openLibrarySeries: ['Discworld'], googleIndex: '5' })).toEqual({
      series: 'Discworld', index: 5,
    })
  })

  it("does not let Google's position override a known volume", () => {
    expect(resolveSeries({ openLibrarySeries: ['Discworld #5'], googleIndex: '9' })).toEqual({
      series: 'Discworld', index: 5,
    })
  })

  it('drops a publisher imprint entirely', () => {
    expect(resolveSeries({ openLibrarySeries: ['Penguin Classics'] })).toBeNull()
  })

  it('returns null when no source carries a series', () => {
    expect(resolveSeries({ title: 'Dune' })).toBeNull()
    expect(resolveSeries({})).toBeNull()
  })
})

describe('groupBySeries', () => {
  const book = (series: string | null, series_index: number | null, id: string) =>
    ({ series, series_index, id })

  it('groups differing spellings under one key', () => {
    const groups = groupBySeries([
      book('Harry Potter', 1, 'a'),
      book('The Harry Potter Series', 2, 'b'),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].books.map((b) => b.id)).toEqual(['a', 'b'])
  })

  it('shows the longest spelling as the display name', () => {
    const groups = groupBySeries([book('HP', 1, 'a'), book('Harry Potter', 2, 'b')])
    expect(groups[0].series).toBe('Harry Potter')
  })

  it('sorts volumes by index, unnumbered last', () => {
    const groups = groupBySeries([
      book('Discworld', null, 'x'),
      book('Discworld', 3, 'c'),
      book('Discworld', 1, 'a'),
      book('Discworld', 2.5, 'b'),
    ])
    expect(groups[0].books.map((b) => b.id)).toEqual(['a', 'b', 'c', 'x'])
  })

  it('drops books with no series', () => {
    expect(groupBySeries([book(null, null, 'a'), book('', 1, 'b')])).toEqual([])
  })

  it('handles an empty shelf', () => {
    expect(groupBySeries([])).toEqual([])
  })
})

describe('missingVolumes', () => {
  it('reports a gap inside what you own', () => {
    expect(missingVolumes([1, 2, 4])).toEqual([3])
    expect(missingVolumes([1, 5])).toEqual([2, 3, 4])
  })

  it('reports nothing for a complete run', () => {
    expect(missingVolumes([1, 2, 3])).toEqual([])
  })

  it('cannot know about volumes past the last one you own', () => {
    expect(missingVolumes([1, 2])).toEqual([])
  })

  it('ignores fractional and missing volumes', () => {
    expect(missingVolumes([1, 2.5, 3])).toEqual([2])
    expect(missingVolumes([1, null, 3, undefined])).toEqual([2])
  })

  it('needs at least two numbered volumes', () => {
    expect(missingVolumes([])).toEqual([])
    expect(missingVolumes([5])).toEqual([])
    expect(missingVolumes([null, null])).toEqual([])
  })
})
