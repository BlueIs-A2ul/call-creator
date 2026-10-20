import { nanoid } from 'nanoid'
import type { Row } from './types'

/** 检测间奏的最小间隔：默认 10 秒 */
export const DEFAULT_MIN_GAP_MS = 10_000
/** 行号徽标的最小间隔：默认 6 秒 */
export const DISPLAY_MIN_GAP_MS = 6_000

export interface InterludeSlot {
  /** 间隙前一行歌词的 row.id，插入时作锚点 */
  beforeId: string
  /** 上一句歌词的起点时间戳（近似） */
  startMs: number
  /** 下一句歌词的起点时间戳（精确） */
  endMs: number
  gapMs: number
}

export interface InterludeBadge {
  startMs: number
  endMs: number
}

/**
 * 当前 rows 里的间奏候选：相邻两行都有 timeMs 且差 ≥ minGapMs，
 * 且两行之间还没有空白行（幂等）。
 */
export function findInterludeSlots(rows: Row[], minGapMs = DEFAULT_MIN_GAP_MS): InterludeSlot[] {
  const slots: InterludeSlot[] = []
  let previous: Row | null = null
  let blankBetween = false

  for (const row of rows) {
    if (!row.lyric) {
      if (previous) blankBetween = true
      continue
    }
    if (previous && previous.timeMs != null && row.timeMs != null) {
      const gapMs = row.timeMs - previous.timeMs
      if (gapMs >= minGapMs && !blankBetween) {
        slots.push({ beforeId: previous.id, startMs: previous.timeMs, endMs: row.timeMs, gapMs })
      }
    }
    previous = row
    blankBetween = false
  }

  return slots
}

/** 在 slotIds 指定的锚点行之后插入空白行；不修改入参 rows。 */
export function applyInterludeSlots(rows: Row[], slotIds: Set<string>): Row[] {
  const result: Row[] = []
  for (const row of rows) {
    result.push(row)
    if (row.lyric && slotIds.has(row.id)) result.push({ id: nanoid(), lyric: '' })
  }
  return result
}

/**
 * 第 index 行为空白行时，计算它对应间奏区间；不满足条件返回 null。
 * 只标连续空白行的第一行。
 */
export function interludeBadgeFor(rows: Row[], index: number): InterludeBadge | null {
  const row = rows[index]
  if (!row || row.lyric) return null
  if (index > 0 && !rows[index - 1].lyric) return null

  let previous: Row | undefined
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (rows[cursor].lyric) {
      previous = rows[cursor]
      break
    }
  }
  let next: Row | undefined
  for (let cursor = index + 1; cursor < rows.length; cursor += 1) {
    if (rows[cursor].lyric) {
      next = rows[cursor]
      break
    }
  }

  if (!previous || !next || previous.timeMs == null || next.timeMs == null) return null
  if (next.timeMs - previous.timeMs < DISPLAY_MIN_GAP_MS) return null
  return { startMs: previous.timeMs, endMs: next.timeMs }
}

/** mm:ss（向下取整到秒）。 */
export function formatClock(timeMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
