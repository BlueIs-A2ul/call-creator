// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetTable } from '@web/components/SheetTable'
import { InterludeDialog } from '@web/components/InterludeDialog'
import { useProjectStore } from '@web/state/project-store'
import type { Project } from '@shared/types'

const project: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 't',
  artist: 'a',
  rows: [
    { id: 'l1', lyric: '第一句', timeMs: 45_000 },
    { id: 'b1', lyric: '' },
    { id: 'l2', lyric: '第二句', timeMs: 58_000 },
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

describe('SheetTable 间奏徽标', () => {
  it('空白行显示间奏区间徽标', () => {
    render(<SheetTable />)
    expect(screen.getByText('间奏 00:45–00:58')).toBeInTheDocument()
  })

  it('无时间戳的空白行不显示徽标', () => {
    useProjectStore.setState({
      project: { ...structuredClone(project), rows: [{ id: 'b1', lyric: '' }] },
    })
    render(<SheetTable />)
    expect(screen.queryByText(/间奏 /)).toBeNull()
  })

  it('行号栏的 × 按钮能删除该行', () => {
    render(<SheetTable />)
    fireEvent.click(screen.getAllByTitle('删除行')[0])
    expect(useProjectStore.getState().project!.rows.map((row) => row.lyric)).toEqual(['', '第二句'])
  })
})

describe('InterludeDialog', () => {
  const dialogProject: Project = {
    ...structuredClone(project),
    rows: [
      { id: 'l1', lyric: '第一句', timeMs: 45_000 },
      { id: 'l2', lyric: '第二句', timeMs: 58_000 }, // 13s gap
      { id: 'l3', lyric: '第三句', timeMs: 66_000 }, // 8s gap（低于默认 10s）
    ],
  }

  beforeEach(() => {
    useProjectStore.setState({
      project: structuredClone(dialogProject),
      past: [],
      future: [],
      dirty: false,
      lastCommit: { key: '', at: 0 },
    })
  })

  it('默认最小间隔 10 秒时只列出 13 秒候选，并可整批插入', () => {
    const onClose = vi.fn()
    render(<InterludeDialog onClose={onClose} />)
    expect(screen.getByText(/间奏 00:45–00:58/)).toBeInTheDocument()
    expect(screen.queryByText(/间奏 00:58–01:06/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '插入间奏行' }))

    const rows = useProjectStore.getState().project!.rows
    expect(rows.map((row) => row.lyric)).toEqual(['第一句', '', '第二句', '第三句'])
    expect(onClose).toHaveBeenCalled()
  })

  it('调低最小间隔后出现 8 秒候选', () => {
    render(<InterludeDialog onClose={() => {}} />)
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '6' } })
    expect(screen.getByText(/间奏 00:58–01:06/)).toBeInTheDocument()
  })

  it('没有时间戳时给出提示且不显示插入按钮', () => {
    useProjectStore.setState({
      project: {
        ...structuredClone(dialogProject),
        rows: [
          { id: 'l1', lyric: '纯文本' },
          { id: 'l2', lyric: '没有时间戳' },
        ],
      },
    })
    render(<InterludeDialog onClose={() => {}} />)
    expect(screen.getByText(/没有时间戳/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '插入间奏行' })).toBeNull()
  })
})
