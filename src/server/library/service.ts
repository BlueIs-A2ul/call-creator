import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { nanoid } from 'nanoid'
import type { LibraryEntry } from '@shared/types'

interface RawEntry {
  filename: string
  keywords: string[]
  text_content: string
  link?: string
  last_updated?: string
}

interface LibraryMeta {
  fetchedAt: string
  count: number
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export function toBuiltinEntries(raw: unknown): LibraryEntry[] {
  if (!Array.isArray(raw)) throw new Error('词库响应不是数组')
  const occurrences = new Map<string, number>()

  return raw.map((value) => {
    const item = value as RawEntry
    const base = `${item.filename}\u0000${item.text_content}`
    const occurrence = occurrences.get(base) ?? 0
    occurrences.set(base, occurrence + 1)
    const id = `builtin-${createHash('sha256').update(`${base}\u0000${occurrence}`).digest('hex').slice(0, 12)}`

    return {
      id,
      filename: item.filename,
      keywords: item.keywords ?? [],
      text_content: item.text_content,
      link: item.link,
      last_updated: item.last_updated,
      origin: 'builtin' as const,
    }
  })
}

export function mergeLibrary(
  builtin: LibraryEntry[],
  user: LibraryEntry[],
  hiddenIds: string[],
): LibraryEntry[] {
  const hidden = new Set(hiddenIds)
  const userById = new Map(user.map((entry) => [entry.id, entry]))
  const merged: LibraryEntry[] = []

  for (const entry of builtin) {
    if (hidden.has(entry.id)) continue
    merged.push(userById.get(entry.id) ?? entry)
    userById.delete(entry.id)
  }
  for (const entry of userById.values()) merged.push(entry)
  return merged
}

export function searchLibrary(
  entries: LibraryEntry[],
  query: string,
  tags: string[],
  limit = 50,
): LibraryEntry[] {
  const keyword = query.trim().toLowerCase()
  const selectedTags = new Set(tags)

  return entries
    .map((entry) => {
      if (selectedTags.size > 0 && !entry.keywords.some((tag) => selectedTags.has(tag))) {
        return null
      }
      if (!keyword) return { entry, score: 0 }

      const name = entry.filename.toLowerCase()
      const tagText = entry.keywords.join(' ').toLowerCase()
      const body = entry.text_content.toLowerCase()
      let score = 0
      if (name.includes(keyword)) score += 100
      if (tagText.includes(keyword)) score += 50
      if (body.includes(keyword)) score += 10
      return score > 0 ? { entry, score } : null
    })
    .filter((value): value is { entry: LibraryEntry; score: number } => value !== null)
    .sort((a, b) => b.score - a.score || a.entry.filename.localeCompare(b.entry.filename))
    .slice(0, limit)
    .map((value) => value.entry)
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return fallback
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.${nanoid(6)}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  await rename(temp, file)
}

export interface LibraryService {
  getMerged(forceRefresh?: boolean): Promise<{
    entries: LibraryEntry[]
    meta: LibraryMeta | null
    stale: boolean
  }>
  addUser(input: Omit<LibraryEntry, 'id' | 'origin'>): Promise<LibraryEntry>
  updateUser(id: string, patch: Partial<LibraryEntry>): Promise<LibraryEntry>
  removeUser(id: string): Promise<void>
  setHidden(id: string, hidden: boolean): Promise<void>
}

export function createLibraryService(dataDir: string, remoteUrl: string): LibraryService {
  const builtinFile = join(dataDir, 'cache', 'library.json')
  const metaFile = join(dataDir, 'cache', 'library.meta.json')
  const userFile = join(dataDir, 'library.user.json')
  const hiddenFile = join(dataDir, 'library.hidden.json')

  async function loadBuiltin(forceRefresh: boolean): Promise<{ entries: LibraryEntry[]; meta: LibraryMeta | null; stale: boolean }> {
    const cached = await readJson<LibraryEntry[] | null>(builtinFile, null)
    const meta = await readJson<LibraryMeta | null>(metaFile, null)
    const fresh = meta !== null && Date.now() - Date.parse(meta.fetchedAt) < CACHE_TTL_MS

    if (!forceRefresh && cached && fresh) {
      return { entries: cached, meta, stale: false }
    }

    try {
      const response = await fetch(remoteUrl, { signal: AbortSignal.timeout(15_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const entries = toBuiltinEntries(await response.json())
      const nextMeta = { fetchedAt: new Date().toISOString(), count: entries.length }
      await writeJson(builtinFile, entries)
      await writeJson(metaFile, nextMeta)
      return { entries, meta: nextMeta, stale: false }
    } catch (error) {
      if (cached) return { entries: cached, meta, stale: true }
      throw error
    }
  }

  return {
    async getMerged(forceRefresh = false) {
      const builtin = await loadBuiltin(forceRefresh)
      const user = await readJson<LibraryEntry[]>(userFile, [])
      const hidden = await readJson<string[]>(hiddenFile, [])
      return {
        entries: mergeLibrary(builtin.entries, user, hidden),
        meta: builtin.meta,
        stale: builtin.stale,
      }
    },

    async addUser(input) {
      const user = await readJson<LibraryEntry[]>(userFile, [])
      const entry: LibraryEntry = {
        ...input,
        id: `user-${nanoid(10)}`,
        origin: 'user',
      }
      user.push(entry)
      await writeJson(userFile, user)
      return entry
    },

    async updateUser(id, patch) {
      const user = await readJson<LibraryEntry[]>(userFile, [])
      const index = user.findIndex((entry) => entry.id === id)
      if (index === -1) throw new Error('词条不存在')
      user[index] = { ...user[index], ...patch, id, origin: 'user' }
      await writeJson(userFile, user)
      return user[index]
    },

    async removeUser(id) {
      const user = await readJson<LibraryEntry[]>(userFile, [])
      await writeJson(userFile, user.filter((entry) => entry.id !== id))
    },

    async setHidden(id, hidden) {
      const ids = new Set(await readJson<string[]>(hiddenFile, []))
      if (hidden) ids.add(id)
      else ids.delete(id)
      await writeJson(hiddenFile, [...ids])
    },
  }
}
