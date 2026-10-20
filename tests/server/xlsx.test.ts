import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { asExcelBuffer, writeXlsx } from '@server/export/xlsx'
import { DEFAULT_EXPORT_OPTIONS, type Project } from '@shared/types'

const project: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 'New World',
  artist: '.LiNIXLiNE.',
  rows: [{ id: 'r1', lyric: 'hello', call: { text: 'call', tags: [] } }],
  variables: {},
  revision: 0,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
}

const grouped: Project = {
  ...project,
  rows: [
    { id: 'g1', lyric: '一', call: { label: '首推call', tags: [], text: 'A', groupId: 'grp' } },
    { id: 'g2', lyric: '二', call: { label: '首推call', tags: [], text: 'B', groupId: 'grp' } },
    { id: 'g3', lyric: '三', call: { label: '首推call', tags: [], text: 'C', groupId: 'grp' } },
    { id: 'n1', lyric: '四', call: { text: 'solo', tags: [] } },
  ],
}

async function readBack(source: Project) {
  const buffer = await writeXlsx(source, DEFAULT_EXPORT_OPTIONS)
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(asExcelBuffer(buffer))
  return workbook.worksheets[0]
}

describe('writeXlsx', () => {
  it('生成可读回的工作簿', async () => {
    const sheet = await readBack(project)
    expect(sheet.getCell('A1').value).toBe('序号')
    expect(sheet.getCell('B2').value).toBe('hello')
    expect(sheet.getCell('C2').value).toContain('call')
  })

  it('跨行的 call 纵向合并成一个单元格', async () => {
    const sheet = await readBack(grouped)
    expect(sheet.getCell('C2').isMerged).toBe(true)
    expect(sheet.getCell('C2').master.address).toBe('C2')
    expect(sheet.getCell('C3').master.address).toBe('C2')
    expect(sheet.getCell('C4').isMerged).toBe(true)
    expect(sheet.getCell('C4').master.address).toBe('C2')
    expect(String(sheet.getCell('C2').value)).toBe('首推call\nA\nB\nC')
  })

  it('合并块自己算行高，不依赖 Excel 自动撑开', async () => {
    const sheet = await readBack(grouped)
    const heights = [2, 3, 4].map((rowNumber) => sheet.getRow(rowNumber).height)
    expect(heights.every((height) => typeof height === 'number' && height >= 15)).toBe(true)
  })

  it('块后面那一行不参与合并', async () => {
    const sheet = await readBack(grouped)
    expect(sheet.getCell('C5').isMerged).toBeFalsy()
    expect(String(sheet.getCell('C5').value)).toBe('solo')
  })
})
