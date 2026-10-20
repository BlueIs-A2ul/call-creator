import type { LyricLine } from './types'

export interface ParsedLyrics {
  title?: string
  artist?: string
  album?: string
  lines: LyricLine[]
  warnings: string[]
}

const TIMESTAMP_RE = /\[(\d{1,3}):(\d{1,2})([.:])(\d{1,3})\]/g
const META_RE = /^\[(ti|ar|al|by|offset|length):(.*)\]$/i

export function parseLrc(raw: string): ParsedLyrics {
  const meta: Record<string, string> = {}
  const entries: Array<{ text: string; stamped: boolean; times: number[] }> = []

  for (const source of raw.split(/\r?\n/)) {
    const line = source.trim()
    if (!line) continue

    const metaMatch = line.match(META_RE)
    if (metaMatch) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim()
      continue
    }

    TIMESTAMP_RE.lastIndex = 0
    const times: number[] = []
    let match: RegExpExecArray | null
    while ((match = TIMESTAMP_RE.exec(line)) !== null) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const milliseconds = Number(match[4].padEnd(3, '0').slice(0, 3))
      times.push(minutes * 60_000 + seconds * 1_000 + milliseconds)
    }

    const text = line.replace(TIMESTAMP_RE, '').trim()
    if (!text) continue
    entries.push({ text, stamped: times.length > 0, times })
  }

  const hasAnyStamp = entries.some((entry) => entry.stamped)
  const warnings: string[] = []
  const lines: LyricLine[] = []

  for (const entry of entries) {
    if (entry.times.length === 0) {
      if (hasAnyStamp) warnings.push(`无法识别时间戳：${entry.text.slice(0, 30)}`)
      lines.push({ text: entry.text })
      continue
    }
    for (const timeMs of entry.times) lines.push({ text: entry.text, timeMs })
  }

  lines.sort((a, b) => (a.timeMs ?? Number.MAX_SAFE_INTEGER) - (b.timeMs ?? Number.MAX_SAFE_INTEGER))

  return {
    title: meta.ti,
    artist: meta.ar,
    album: meta.al,
    lines,
    warnings,
  }
}
