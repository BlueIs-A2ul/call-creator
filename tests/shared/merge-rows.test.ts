import { describe, expect, it } from 'vitest'
import { mergeRows } from '@shared/merge-rows'
import type { Row } from '@shared/types'

const call = { text: 'call', tags: [] }

describe('mergeRows', () => {
  it('按文本匹配并保留 call', () => {
    const oldRows: Row[] = [
      { id: 'r1', lyric: 'hello', call },
      { id: 'r2', lyric: 'world' },
    ]
    const result = mergeRows(oldRows, [{ text: 'hello' }, { text: 'world' }])
    expect(result.rows[0].id).toBe('r1')
    expect(result.rows[0].call?.text).toBe('call')
    expect(result.orphans).toHaveLength(0)
  })

  it('重复歌词按出现顺序匹配', () => {
    const oldRows: Row[] = [
      { id: 'r1', lyric: 'chorus', call: { text: 'first', tags: [] } },
      { id: 'r2', lyric: 'chorus', call: { text: 'second', tags: [] } },
    ]
    const result = mergeRows(oldRows, [{ text: 'chorus' }, { text: 'chorus' }])
    expect(result.rows.map((row) => row.id)).toEqual(['r1', 'r2'])
  })

  it('空白行跟随它前面的歌词行', () => {
    const oldRows: Row[] = [
      { id: 'r1', lyric: 'hello' },
      { id: 'b1', lyric: '', call: { text: 'interlude', tags: [] } },
      { id: 'r2', lyric: 'world' },
    ]
    const result = mergeRows(oldRows, [{ text: 'hello' }, { text: 'world' }])
    expect(result.rows.map((row) => row.id)).toEqual(['r1', 'b1', 'r2'])
  })

  it('无法匹配的旧 call 进入 orphans', () => {
    const oldRows: Row[] = [{ id: 'r1', lyric: 'removed', call }]
    const result = mergeRows(oldRows, [{ text: 'new' }])
    expect(result.orphans.map((row) => row.id)).toEqual(['r1'])
  })
})
