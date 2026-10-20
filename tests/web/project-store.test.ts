import { beforeEach, describe, expect, it } from 'vitest'
import { useProjectStore } from '@web/state/project-store'
import type { Project } from '@shared/types'

const project: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 'New World',
  artist: '.LiNIXLiNE.',
  rows: [
    { id: 'r1', lyric: 'hello' },
    { id: 'r2', lyric: 'world' },
  ],
  variables: {},
  revision: 0,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
}

beforeEach(() => {
  useProjectStore.setState({
    project: structuredClone(project),
    past: [],
    future: [],
    dirty: false,
    lastCommit: { key: '', at: 0 },
  })
})

describe('project store', () => {
  it('插入空白行', () => {
    useProjectStore.getState().insertRow('r1')
    const rows = useProjectStore.getState().project!.rows
    expect(rows).toHaveLength(3)
    expect(rows[1].lyric).toBe('')
  })

  it('删除行', () => {
    useProjectStore.getState().deleteRows(['r1'])
    expect(useProjectStore.getState().project!.rows.map((row) => row.id)).toEqual(['r2'])
  })

  it('撤销恢复删除', () => {
    useProjectStore.getState().deleteRows(['r1'])
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().project!.rows).toHaveLength(2)
  })

  it('编辑歌词', () => {
    useProjectStore.getState().updateLyric('r1', 'changed')
    expect(useProjectStore.getState().project!.rows[0].lyric).toBe('changed')
  })

  it('修改标题', () => {
    useProjectStore.getState().updateTitle('Renamed')
    expect(useProjectStore.getState().project!.title).toBe('Renamed')
  })
})
