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
