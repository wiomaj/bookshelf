import { z } from 'zod'

const CURRENT_YEAR = new Date().getFullYear()

export const BookInputSchema = z.object({
  title:     z.string().min(1, 'Title is required').max(500),
  author:    z.string().max(500).default(''),
  genre:     z.string().max(200).optional(),
  year:      z.number().int().min(1450).max(CURRENT_YEAR + 1),
  // 1–12 = calendar months, 13–16 = seasons, null = unknown
  month:     z.number().int().min(1).max(16).nullable(),
  rating:    z.number().int().min(1).max(5),
  notes:     z.string().max(10_000).optional(),
  cover_url: z.string().url().max(2_000).optional().or(z.literal('')).transform(v => v || undefined),
})

export type BookInput = z.infer<typeof BookInputSchema>
