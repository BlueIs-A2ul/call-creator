import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { writeXlsx } from '@server/export/xlsx'
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

describe('writeXlsx', () => {
  it('生成可读回的工作簿', async () => {
    const buffer = await writeXlsx(project, DEFAULT_EXPORT_OPTIONS)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    const sheet = workbook.worksheets[0]
    expect(sheet.getCell('A1').value).toBe('序号')
    expect(sheet.getCell('B2').value).toBe('hello')
    expect(sheet.getCell('C2').value).toContain('call')
  })
})
