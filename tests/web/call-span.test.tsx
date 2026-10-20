// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SheetTable } from '@web/components/SheetTable'
import { useProjectStore } from '@web/state/project-store'
import type { Project } from '@shared/types'

const block = (groupId: string, text: string, lyric: string, id: string) => ({
  id,
  lyric,
  call: { label: '首推call', tags: ['分词Call'], text, groupId },
})

const project: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 't',
  artist: 'a',
  rows: [
    block('g1', 'A', '第一句', 'l1'),
    block('g1', 'B', '第二句', 'l2'),
    block('g1', 'C', '第三句', 'l3'),
    { id: 'l4', lyric: '第四句' },
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

const rowNumbers = () => screen.getAllByRole('button', { name: /^\d+$/ })

describe('跨行 call 的删除', () => {
  it('选中整块后一次清掉，歌词行保留', () => {
    render(<SheetTable />)
    fireEvent.click(rowNumbers()[0])
    fireEvent.click(rowNumbers()[2], { shiftKey: true })

    fireEvent.click(screen.getByRole('button', { name: /^清除 call/ }))

    const rows = useProjectStore.getState().project!.rows
    expect(rows.every((row) => row.call === undefined)).toBe(true)
    expect(rows.map((row) => row.lyric)).toEqual(['第一句', '第二句', '第三句', '第四句'])
  })

  it('没选中有 call 的行时，「清除 call」是不可点的', () => {
    render(<SheetTable />)
    fireEvent.click(rowNumbers()[3])
    expect(screen.getByRole('button', { name: /^清除 call/ })).toBeDisabled()
  })

  it('单行右下角的「清除」只清这一行', () => {
    render(<SheetTable />)
    fireEvent.click(screen.getAllByRole('button', { name: '清除这一行的 call' })[1])

    const rows = useProjectStore.getState().project!.rows
    expect(rows[1].call).toBeUndefined()
    expect(rows[0].call?.text).toBe('A')
    expect(rows[2].call?.text).toBe('C')
  })

  it('块内的行仍然显示自己是第几段', () => {
    render(<SheetTable />)
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByText('3/3')).toBeInTheDocument()
  })
})
