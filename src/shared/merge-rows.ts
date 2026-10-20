import { nanoid } from 'nanoid'
import type { LyricLine, Row } from './types'

export interface MergeResult {
  rows: Row[]
  cleanRows: Row[]
  orphans: Row[]
}

function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

export function mergeRows(oldRows: Row[], lines: LyricLine[]): MergeResult {
  const buckets = new Map<string, Row[]>()
  for (const row of oldRows) {
    if (!row.lyric) continue
    const key = normalize(row.lyric)
    const bucket = buckets.get(key) ?? []
    bucket.push(row)
    buckets.set(key, bucket)
  }

  const idMap = new Map<string, string>()
  const used = new Set<string>()

  const rows: Row[] = lines.map((line) => {
    const bucket = buckets.get(normalize(line.text))
    const matched = bucket?.shift()
    if (matched) {
      used.add(matched.id)
      idMap.set(matched.id, matched.id)
      return { ...matched, lyric: line.text, timeMs: line.timeMs }
    }
    const id = nanoid()
    return { id, lyric: line.text, timeMs: line.timeMs }
  })

  const blankPlacements: Array<{ afterOldId: string | null; row: Row }> = []
  let lastLyricId: string | null = null
  for (const row of oldRows) {
    if (row.lyric) {
      lastLyricId = row.id
    } else {
      blankPlacements.push({ afterOldId: lastLyricId, row })
    }
  }

  const orphanRows: Row[] = []
  const orphanPlacements: Array<{ afterOldId: string | null; row: Row }> = []
  let lastMatchedId: string | null = null
  for (const row of oldRows) {
    if (row.lyric && used.has(row.id)) {
      lastMatchedId = row.id
    } else if (row.lyric && row.call) {
      orphanRows.push(row)
      orphanPlacements.push({ afterOldId: lastMatchedId, row: { ...row, lyric: '' } })
    }
  }

  const insertAfter = new Map<string | null, Row[]>()
  for (const placement of [...blankPlacements, ...orphanPlacements]) {
    const anchor = placement.afterOldId && idMap.has(placement.afterOldId)
      ? idMap.get(placement.afterOldId)!
      : null
    const bucket = insertAfter.get(anchor) ?? []
    bucket.push(placement.row)
    insertAfter.set(anchor, bucket)
  }

  const merged: Row[] = [...(insertAfter.get(null) ?? [])]
  for (const row of rows) {
    merged.push(row)
    const extras = insertAfter.get(row.id)
    if (extras) merged.push(...extras)
  }

  const orphanIds = new Set(orphanRows.map((row) => row.id))
  return {
    rows: merged,
    cleanRows: merged.filter((row) => !orphanIds.has(row.id)),
    orphans: orphanRows,
  }
}
