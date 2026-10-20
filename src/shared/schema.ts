import { z } from 'zod'

export const callCellSchema = z.object({
  label: z.string().optional(),
  text: z.string(),
  tags: z.array(z.string()),
  sourceId: z.string().optional(),
  overrides: z.record(z.string()).optional(),
  note: z.string().optional(),
})

export const rowSchema = z.object({
  id: z.string().min(1),
  lyric: z.string(),
  timeMs: z.number().optional(),
  call: callCellSchema.optional(),
})

export const libraryEntrySchema = z.object({
  id: z.string(),
  filename: z.string(),
  keywords: z.array(z.string()),
  text_content: z.string(),
  link: z.string().optional(),
  last_updated: z.string().optional(),
  origin: z.enum(['builtin', 'user']),
  hidden: z.boolean().optional(),
})

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  title: z.string(),
  artist: z.string(),
  album: z.string().optional(),
  durationMs: z.number().optional(),
  source: z
    .object({
      provider: z.enum(['netease', 'qq', 'paste', 'xlsx']),
      url: z.string().optional(),
      fetchedAt: z.string(),
    })
    .optional(),
  rows: z.array(rowSchema),
  variables: z.record(z.string()),
  librarySnapshot: z.array(libraryEntrySchema).optional(),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const lyricsInputSchema = z
  .object({
    url: z.string().optional(),
    text: z.string().optional(),
    provider: z.enum(['netease', 'qq', 'paste']).optional(),
    songmid: z.string().optional(),
  })
  .refine((value) => Boolean(value.url || value.text || value.songmid), {
    message: 'url、text、songmid 至少提供一个',
  })

export const exportOptionsSchema = z.object({
  mergeBlankRows: z.boolean().default(false),
  includeTags: z.boolean().default(false),
  includeNote: z.boolean().default(false),
  includeTime: z.boolean().default(false),
  applySubstitutions: z.boolean().default(false),
})

export const libraryInputSchema = z.object({
  filename: z.string().min(1),
  keywords: z.array(z.string()).default([]),
  text_content: z.string().min(1),
  link: z.string().optional(),
})
