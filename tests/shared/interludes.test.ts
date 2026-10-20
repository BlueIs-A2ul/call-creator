import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MIN_GAP_MS,
  DISPLAY_MIN_GAP_MS,
  applyInterludeSlots,
  findInterludeSlots,
  formatClock,
  interludeBadgeFor,
} from '@shared/interludes'
import type { Row } from '@shared/types'

const line = (id: string, lyric: string, timeMs?: number): Row => ({ id, lyric, timeMs })

describe('findInterludeSlots', () => {
  it('相邻两行时间差达到阈值时产生候选', () => {
    const rows = [line('l1', 'a', 45_000), line('l2', 'b', 58_000)]
    expect(findInterludeSlots(rows)).toEqual([
      { beforeId: 'l1', startMs: 45_000, endMs: 58_000, gapMs: 13_000 },
    ])
  })

  it('小于阈值不产生候选（边界：差 1 毫秒）', () => {
    const rows = [line('l1', 'a', 45_000), line('l2', 'b', 45_000 + DEFAULT_MIN_GAP_MS - 1)]
    expect(findInterludeSlots(rows)).toEqual([])
  })

  it('缺时间戳的行不参与检测', () => {
    const rows = [line('l1', 'a'), line('l2', 'b', 60_000)]
    expect(findInterludeSlots(rows)).toEqual([])
  })

  it('间隙里已有空白行时跳过（幂等）', () => {
    const rows = [line('l1', 'a', 45_000), line('b1', ''), line('l2', 'b', 58_000)]
    expect(findInterludeSlots(rows)).toEqual([])
  })

  it('可调最小间隔', () => {
    const rows = [line('l1', 'a', 45_000), line('l2', 'b', 53_000)]
    expect(findInterludeSlots(rows, 10_000)).toEqual([])
    expect(findInterludeSlots(rows, 6_000)).toHaveLength(1)
  })
})

describe('applyInterludeSlots', () => {
  it('在锚点行之后插入一个空白行', () => {
    const rows = [line('l1', 'a', 45_000), line('l2', 'b', 58_000)]
    const result = applyInterludeSlots(rows, new Set(['l1']))
    expect(result.map((row) => row.lyric)).toEqual(['a', '', 'b'])
    expect(result[0].id).toBe('l1')
    expect(result[2].id).toBe('l2')
    expect(result[1].id).not.toBe('')
  })

  it('多个锚点从后往前插入也不影响顺序', () => {
    const rows = [line('l1', 'a', 1_000), line('l2', 'b', 20_000), line('l3', 'c', 40_000)]
    const result = applyInterludeSlots(rows, new Set(['l1', 'l2']))
    expect(result.map((row) => row.lyric)).toEqual(['a', '', 'b', '', 'c'])
  })

  it('不修改原数组', () => {
    const rows = [line('l1', 'a', 45_000)]
    applyInterludeSlots(rows, new Set(['l1']))
    expect(rows).toHaveLength(1)
  })
})

describe('interludeBadgeFor', () => {
  it('空白行两侧都有时间戳且间隔足够时返回区间', () => {
    const rows = [line('l1', 'a', 45_000), line('b1', ''), line('l2', 'b', 58_000)]
    expect(interludeBadgeFor(rows, 1)).toEqual({ startMs: 45_000, endMs: 58_000 })
  })

  it('间隔小于展示阈值时返回 null', () => {
    const rows = [line('l1', 'a', 45_000), line('b1', ''), line('l2', 'b', 45_000 + DISPLAY_MIN_GAP_MS - 1)]
    expect(interludeBadgeFor(rows, 1)).toBeNull()
  })

  it('任一侧缺时间戳时返回 null', () => {
    const rows = [line('l1', 'a'), line('b1', ''), line('l2', 'b', 58_000)]
    expect(interludeBadgeFor(rows, 1)).toBeNull()
  })

  it('连续空白行只标第一行', () => {
    const rows = [line('l1', 'a', 45_000), line('b1', ''), line('b2', ''), line('l2', 'b', 58_000)]
    expect(interludeBadgeFor(rows, 1)).not.toBeNull()
    expect(interludeBadgeFor(rows, 2)).toBeNull()
  })

  it('非空白行或越界返回 null', () => {
    const rows = [line('l1', 'a', 45_000), line('l2', 'b', 58_000)]
    expect(interludeBadgeFor(rows, 0)).toBeNull()
    expect(interludeBadgeFor(rows, 9)).toBeNull()
  })
})

describe('formatClock', () => {
  it('输出 mm:ss', () => {
    expect(formatClock(45_000)).toBe('00:45')
    expect(formatClock(65_400)).toBe('01:05')
    expect(formatClock(0)).toBe('00:00')
  })
})
