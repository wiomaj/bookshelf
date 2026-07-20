import { describe, it, expect } from 'vitest'
import { compareByFinishDate } from '@/lib/bookApi'
import type { Book } from '@/types/book'

function makeBook(overrides: Partial<Book>): Book {
  return {
    id: 'id',
    user_id: 'user',
    title: 'Title',
    author: 'Author',
    year: 2026,
    month: 7,
    rating: 3,
    created_at: '2026-07-01T00:00:00Z',
    status: 'read',
    ...overrides,
  }
}

describe('compareByFinishDate', () => {
  it('sorts newest year first', () => {
    const a = makeBook({ year: 2025 })
    const b = makeBook({ year: 2026 })
    expect([a, b].sort(compareByFinishDate).map(x => x.year)).toEqual([2026, 2025])
  })

  it('sorts newest month first within a year', () => {
    const jun = makeBook({ month: 6 })
    const jul = makeBook({ month: 7 })
    expect([jun, jul].sort(compareByFinishDate)[0]).toBe(jul)
  })

  it('breaks same-month ties by finished_at, not created_at', () => {
    // Added to the to-read list long ago, but finished last.
    const finishedLast = makeBook({
      title: 'Der Wisent',
      created_at: '2026-01-05T00:00:00Z',
      finished_at: '2026-07-18T00:00:00Z',
    })
    const finishedFirst = makeBook({
      title: 'Schloss Gripsholm',
      created_at: '2026-07-10T00:00:00Z',
      finished_at: '2026-07-10T00:00:00Z',
    })
    const sorted = [finishedFirst, finishedLast].sort(compareByFinishDate)
    expect(sorted.map(b => b.title)).toEqual(['Der Wisent', 'Schloss Gripsholm'])
  })

  it('falls back to created_at when finished_at is missing (legacy rows)', () => {
    const older = makeBook({ created_at: '2026-07-01T00:00:00Z' })
    const newer = makeBook({ created_at: '2026-07-15T00:00:00Z' })
    expect([older, newer].sort(compareByFinishDate)[0]).toBe(newer)
  })

  it('a book with finished_at outranks a same-month legacy book added earlier', () => {
    const legacy = makeBook({ created_at: '2026-07-10T00:00:00Z' })
    const stamped = makeBook({
      created_at: '2026-02-01T00:00:00Z',
      finished_at: '2026-07-20T00:00:00Z',
    })
    expect([legacy, stamped].sort(compareByFinishDate)[0]).toBe(stamped)
  })

  it('sorts season codes by their midpoint month', () => {
    const summer = makeBook({ month: 14 }) // midpoint Jul
    const may = makeBook({ month: 5 })
    const sep = makeBook({ month: 9 })
    const sorted = [may, summer, sep].sort(compareByFinishDate)
    expect(sorted.map(b => b.month)).toEqual([9, 14, 5])
  })
})
