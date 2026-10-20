import { describe, expect, it } from 'vitest'
import { callGroupIndex, findCallGroup, readCallGroups } from '@shared/call-groups'
import type { Row } from '@shared/types'

const rows: Row[] = [
  { id: 'a', lyric: '1' },
  { id: 'b', lyric: '2', call: { text: 'xx', tags: [], groupId: 'g1' } },
  { id: 'c', lyric: '3', call: { text: 'yy', tags: [], groupId: 'g1' } },
  { id: 'd', lyric: '4', call: { text: 'zz', tags: [], groupId: 'g1' } },
  { id: 'e', lyric: '5' },
  { id: 'f', lyric: '6', call: { text: 'ww', tags: [], groupId: 'g1' } },
]

describe('readCallGroups', () => {
  it('连续且 groupId 相同的行算一块', () => {
    const groups = readCallGroups(rows)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ id: 'g1', start: 1, end: 3 })
    expect(groups[0].rows.map((row) => row.id)).toEqual(['b', 'c', 'd'])
  })

  it('被别的行隔开的相同 id 算两块', () => {
    const groups = readCallGroups(rows)
    expect(groups[1]).toMatchObject({ id: 'g1', start: 5, end: 5 })
  })

  it('没有 groupId 的行不产生块', () => {
    expect(readCallGroups([{ id: 'a', lyric: '' }, { id: 'b', lyric: '' }])).toEqual([])
  })

  it('按行 id 查到它在块里的位置', () => {
    const index = callGroupIndex(rows)
    expect(index.get('c')).toMatchObject({ slot: 1, size: 3 })
    expect(index.get('e')).toBeUndefined()
    expect(findCallGroup(rows, 'f')).toMatchObject({ slot: 0, size: 1 })
  })
})
