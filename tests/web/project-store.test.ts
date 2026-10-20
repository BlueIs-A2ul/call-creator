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

describe('跨行的 call 块', () => {
  const entry = {
    label: '首推call',
    tags: ['分词Call'],
    sourceId: 'lib-1',
    text: '原文：\n俺の OOO！\nOOO！ OOO！\n罗马字：\nO-Re-No OOO！\nOOO！ OOO！',
  }

  const withRows = (rows: Project['rows']) => {
    useProjectStore.setState({
      project: { ...structuredClone(project), rows },
      past: [],
      future: [],
      dirty: false,
      lastCommit: { key: '', at: 0 },
    })
  }

  it('把词条按行切开，连续的行共享一个 groupId', () => {
    withRows([
      { id: 'r1', lyric: '一' },
      { id: 'r2', lyric: '二' },
      { id: 'r3', lyric: '三' },
    ])
    useProjectStore.getState().applyCallToRows(['r1', 'r2'], entry)

    const rows = useProjectStore.getState().project!.rows
    expect(rows[0].call?.text).toBe('O-Re-No OOO！')
    expect(rows[1].call?.text).toBe('OOO！ OOO！')
    expect(rows[0].call?.groupId).toBe(rows[1].call?.groupId)
    expect(rows[0].call?.groupId).toBeTruthy()
    expect(rows[0].call?.label).toBe('首推call')
    expect(rows[2].call).toBeUndefined()
  })

  it('只选一行时就是普通的整段 call', () => {
    withRows([{ id: 'r1', lyric: '一' }])
    useProjectStore.getState().applyCallToRows(['r1'], entry)
    expect(useProjectStore.getState().project!.rows[0].call?.text).toBe(
      'O-Re-No OOO！\nOOO！ OOO！',
    )
  })

  it('选中的行不相邻时各自成块', () => {
    withRows([
      { id: 'r1', lyric: '一' },
      { id: 'r2', lyric: '二' },
      { id: 'r3', lyric: '三' },
    ])
    useProjectStore.getState().applyCallToRows(['r1', 'r3'], entry)

    const rows = useProjectStore.getState().project!.rows
    expect(rows[0].call?.groupId).toBeTruthy()
    expect(rows[2].call?.groupId).toBeTruthy()
    expect(rows[0].call?.groupId).not.toBe(rows[2].call?.groupId)
  })

  it('改块内一行的名称会同步整块，正文只改这一行', () => {
    withRows([
      { id: 'r1', lyric: '一' },
      { id: 'r2', lyric: '二' },
    ])
    useProjectStore.getState().applyCallToRows(['r1', 'r2'], entry)
    const first = useProjectStore.getState().project!.rows[0]

    useProjectStore.getState().updateCall(first.id, {
      ...first.call!,
      label: '改过的名字',
      text: '只有这一行变了',
    })

    const rows = useProjectStore.getState().project!.rows
    expect(rows[0].call?.label).toBe('改过的名字')
    expect(rows[1].call?.label).toBe('改过的名字')
    expect(rows[1].call?.text).toBe('OOO！ OOO！')
  })

  it('拆出某一行后它就不再属于这个块', () => {
    withRows([
      { id: 'r1', lyric: '一' },
      { id: 'r2', lyric: '二' },
      { id: 'r3', lyric: '三' },
    ])
    useProjectStore.getState().applyCallToRows(['r1', 'r2', 'r3'], entry)
    useProjectStore.getState().unlinkFromGroup('r2')

    const rows = useProjectStore.getState().project!.rows
    expect(rows[1].call?.groupId).toBeUndefined()
    expect(rows[1].call?.label).toBe('首推call')
    expect(rows[0].call?.groupId).toBe(rows[2].call?.groupId)
  })

  it('可以撤销回拆分前', () => {
    withRows([{ id: 'r1', lyric: '一' }, { id: 'r2', lyric: '二' }])
    useProjectStore.getState().applyCallToRows(['r1', 'r2'], entry)
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().project!.rows.every((row) => !row.call)).toBe(true)
  })

  it('清除整块的 call，歌词行保留', () => {
    withRows([
      { id: 'r1', lyric: '一' },
      { id: 'r2', lyric: '二' },
      { id: 'r3', lyric: '三' },
    ])
    useProjectStore.getState().applyCallToRows(['r1', 'r2', 'r3'], entry)
    useProjectStore.getState().clearCalls(['r1', 'r2', 'r3'])

    const rows = useProjectStore.getState().project!.rows
    expect(rows.every((row) => row.call === undefined)).toBe(true)
    expect(rows.map((row) => row.lyric)).toEqual(['一', '二', '三'])
  })

  it('清除块中间一行会让块断成两块', () => {
    withRows([
      { id: 'r1', lyric: '一' },
      { id: 'r2', lyric: '二' },
      { id: 'r3', lyric: '三' },
    ])
    useProjectStore.getState().applyCallToRows(['r1', 'r2', 'r3'], entry)
    useProjectStore.getState().clearCalls(['r2'])

    const rows = useProjectStore.getState().project!.rows
    expect(rows[1].call).toBeUndefined()
    expect(rows[0].call?.groupId).toBe(rows[2].call?.groupId)
  })

  it('清除 call 可以撤销', () => {
    withRows([{ id: 'r1', lyric: '一' }])
    useProjectStore.getState().applyCallToRows(['r1'], entry)
    useProjectStore.getState().clearCalls(['r1'])
    useProjectStore.getState().undo()
    expect(useProjectStore.getState().project!.rows[0].call?.label).toBe('首推call')
  })
})
