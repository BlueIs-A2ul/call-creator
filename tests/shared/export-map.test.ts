import { describe, expect, it } from 'vitest'
import { buildExportRows, formatTime } from '@shared/export-map'
import type { Project } from '@shared/types'

const project: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 'New World',
  artist: '.LiNIXLiNE.',
  rows: [
    { id: 'r1', lyric: 'hello', call: { text: 'call A', tags: ['Mix'] } },
    { id: 'b1', lyric: '', call: { text: 'interlude', tags: [] } },
    { id: 'r2', lyric: 'world' },
  ],
  variables: {},
  revision: 0,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
}

const base = {
  mergeBlankRows: false,
  includeTags: false,
  includeNote: false,
  includeTime: false,
  applySubstitutions: false,
}

describe('buildExportRows', () => {
  it('默认每行一条，空白行也占序号', () => {
    const rows = buildExportRows(project, base)
    expect(rows.map((row) => row.no)).toEqual([1, 2, 3])
    expect(rows[1].lyric).toBe('')
  })

  it('开启合并后空白行并入上一行且不占序号', () => {
    const rows = buildExportRows(project, { ...base, mergeBlankRows: true })
    expect(rows).toHaveLength(2)
    expect(rows[0].call).toContain('interlude')
    expect(rows[1].no).toBe(2)
  })

  it('默认保留占位符', () => {
    const withToken: Project = {
      ...project,
      rows: [{ id: 'r1', lyric: 'x', call: { text: '俺の OOO', tags: [] } }],
      variables: { OOO: '小夏' },
    }
    expect(buildExportRows(withToken, base)[0].call).toBe('俺の OOO')
    expect(buildExportRows(withToken, { ...base, applySubstitutions: true })[0].call).toBe('俺の 小夏')
  })

  it('格式化时间', () => {
    expect(formatTime(22_850)).toBe('00:22.85')
  })
})

describe('跨行的 call 块', () => {
  const grouped: Project = {
    ...project,
    rows: [
      { id: 'g1', lyric: '一', call: { label: '首推call', tags: ['分词Call'], text: 'A', groupId: 'grp' } },
      { id: 'g2', lyric: '二', call: { label: '首推call', tags: ['分词Call'], text: 'B', groupId: 'grp' } },
      { id: 'g3', lyric: '三', call: { label: '首推call', tags: ['分词Call'], text: 'C', groupId: 'grp' } },
      { id: 'n1', lyric: '四' },
    ],
  }

  it('块首写完整体，续行留空并标记合并', () => {
    const rows = buildExportRows(grouped, base)
    expect(rows).toHaveLength(4)
    expect(rows[0].call).toBe('首推call\nA\nB\nC')
    expect(rows[0].span).toBe(3)
    expect(rows[1].call).toBe('')
    expect(rows[1].mergeUp).toBe(true)
    expect(rows[2].mergeUp).toBe(true)
    expect(rows[3].span).toBeUndefined()
  })

  it('块内每行仍然各占一个序号', () => {
    expect(buildExportRows(grouped, base).map((row) => row.no)).toEqual([1, 2, 3, 4])
  })

  it('标签只在块首出现，不跟着重复四遍', () => {
    const rows = buildExportRows(grouped, { ...base, includeTags: true })
    expect(rows[0].tags).toBe('分词Call')
    expect(rows[1].tags).toBe('')
  })

  it('占位符按行替换后再拼成整段', () => {
    const withTokens: Project = {
      ...grouped,
      variables: { OOO: '小夏' },
      rows: grouped.rows.map((row) =>
        row.call ? { ...row, call: { ...row.call, text: `${row.call.text} OOO` } } : row,
      ),
    }
    expect(buildExportRows(withTokens, { ...base, applySubstitutions: true })[0].call).toBe(
      '首推call\nA 小夏\nB 小夏\nC 小夏',
    )
  })

  it('组内的空白行不会被「合并空白行」吃掉', () => {
    const withBlank: Project = {
      ...grouped,
      rows: [
        grouped.rows[0],
        { id: 'g2', lyric: '', call: { label: '首推call', tags: [], text: 'B', groupId: 'grp' } },
        grouped.rows[2],
      ],
    }
    const rows = buildExportRows(withBlank, { ...base, mergeBlankRows: true })
    expect(rows).toHaveLength(3)
    expect(rows[0].span).toBe(3)
  })

  it('块后面的空白行折进整块的块首，不会写进被合并掉的单元格', () => {
    const withBlank: Project = {
      ...grouped,
      rows: [
        ...grouped.rows.slice(0, 3),
        { id: 'b1', lyric: '', call: { text: '间奏 music', tags: [] } },
      ],
    }
    const rows = buildExportRows(withBlank, { ...base, mergeBlankRows: true })
    expect(rows).toHaveLength(3)
    expect(rows[0].call).toBe('首推call\nA\nB\nC\n（间奏）\n间奏 music')
  })
})
