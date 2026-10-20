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

export interface LibraryMeta {
  fetchedAt: string
  count: number
}

export type LibrarySource = 'cache' | 'local' | 'remote'

export interface LibrarySnapshot {
  entries: LibraryEntry[]
  meta: LibraryMeta | null
  source: LibrarySource
  /** true 表示这次本想刷新但失败了，返回的是更旧的数据 */
  stale: boolean
}

export const DEFAULT_LIBRARY_URL = 'https://glx48call.dpdns.org/data/json/single_skill.json'
export const DEFAULT_LIBRARY_FILE = join('library', 'library.json')

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

/** 兼容两种落盘格式：上游原始数组，以及已经补过 id/origin 的数组。 */
export function normalizeEntries(raw: unknown): LibraryEntry[] {
  if (!Array.isArray(raw)) throw new Error('词库数据不是数组')
  const looksNormalized = raw.every(
    (item) =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as { id?: unknown }).id === 'string' &&
      typeof (item as { origin?: unknown }).origin === 'string',
  )
  return looksNormalized ? (raw as LibraryEntry[]) : toBuiltinEntries(raw)
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

export async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.${nanoid(6)}.tmp`
  await writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
  await rename(temp, file)
}

/** 拉取上游词库并归一化成带 id 的条目，供服务与 `npm run library:sync` 复用。 */
export async function fetchLibraryEntries(
  remoteUrl: string,
): Promise<{ entries: LibraryEntry[]; meta: LibraryMeta }> {
  const response = await fetch(remoteUrl, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`词库请求失败（HTTP ${response.status}）`)
  const entries = normalizeEntries(await response.json())
  if (entries.length === 0) throw new Error('词库响应为空')
  return { entries, meta: { fetchedAt: new Date().toISOString(), count: entries.length } }
}

export interface LibraryServiceOptions {
  dataDir: string
  /** 仓库内的词库快照，默认 `library/library.json` */
  localFile?: string
  /** 只有显式刷新（refresh=1 / 没有本地数据）时才会请求 */
  remoteUrl?: string
}

export interface LibraryService {
  getMerged(forceRefresh?: boolean): Promise<LibrarySnapshot>
  addUser(input: Omit<LibraryEntry, 'id' | 'origin'>): Promise<LibraryEntry>
  updateUser(id: string, patch: Partial<LibraryEntry>): Promise<LibraryEntry>
  removeUser(id: string): Promise<void>
  setHidden(id: string, hidden: boolean): Promise<void>
}

export function createLibraryService(options: LibraryServiceOptions): LibraryService {
  const localFile = options.localFile ?? DEFAULT_LIBRARY_FILE
  const remoteUrl = options.remoteUrl
  const cacheFile = join(options.dataDir, 'cache', 'library.json')
  const metaFile = join(options.dataDir, 'cache', 'library.meta.json')
  const userFile = join(options.dataDir, 'library.user.json')
  const hiddenFile = join(options.dataDir, 'library.hidden.json')

  function safeNormalize(value: unknown): LibraryEntry[] | null {
    try {
      const entries = normalizeEntries(value)
      return entries.length > 0 ? entries : null
    } catch {
      return null
    }
  }

  async function readLocal(): Promise<LibraryEntry[] | null> {
    return safeNormalize(await readJson<unknown>(localFile, null))
  }

  async function refreshFromRemote(): Promise<LibrarySnapshot> {
    if (!remoteUrl) throw new Error(`没有可用的词库数据，请先运行 npm run library:sync 生成 ${localFile}`)
    const remote = await fetchLibraryEntries(remoteUrl)
    await writeJson(cacheFile, remote.entries)
    await writeJson(metaFile, remote.meta)
    return { entries: remote.entries, meta: remote.meta, source: 'remote', stale: false }
  }

  async function loadBuiltin(forceRefresh: boolean): Promise<LibrarySnapshot> {
    const cached = safeNormalize(await readJson<unknown>(cacheFile, null))
    const meta = await readJson<LibraryMeta | null>(metaFile, null)

    if (forceRefresh) {
      try {
        return await refreshFromRemote()
      } catch (error) {
        const fallback = cached ?? (await readLocal())
        if (fallback) {
          return { entries: fallback, meta, source: cached ? 'cache' : 'local', stale: true }
        }
        throw error
      }
    }

    // 默认路径完全不联网：先用上次刷新留下的运行时缓存，再用仓库里的快照
    if (cached) return { entries: cached, meta, source: 'cache', stale: false }
    const local = await readLocal()
    if (local) return { entries: local, meta: null, source: 'local', stale: false }

    // 本地确实没有数据时才退回远端（首次部署且未同步过快照）
    return refreshFromRemote()
  }

  return {
    async getMerged(forceRefresh = false) {
      const builtin = await loadBuiltin(forceRefresh)
      const user = await readJson<LibraryEntry[]>(userFile, [])
      const hidden = await readJson<string[]>(hiddenFile, [])
      return {
        entries: mergeLibrary(builtin.entries, user, hidden),
        meta: builtin.meta,
        source: builtin.source,
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
