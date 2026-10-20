import ExcelJS from 'exceljs'
import { buildExportRows } from '@shared/export-map'
import type { ExportOptions, Project } from '@shared/types'

export async function writeXlsx(project: Project, options: ExportOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'callCreator'
  const sheet = workbook.addWorksheet('Call Sheet')

  const columns: Array<{ header: string; key: string; width: number }> = [
    { header: '序号', key: 'no', width: 6 },
    { header: '歌词', key: 'lyric', width: 50 },
    { header: 'Call', key: 'call', width: 60 },
  ]
  if (options.includeTags) columns.push({ header: '标签', key: 'tags', width: 20 })
  if (options.includeNote) columns.push({ header: '备注', key: 'note', width: 24 })
  if (options.includeTime) columns.push({ header: '时间', key: 'time', width: 10 })

  sheet.columns = columns
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  for (const row of buildExportRows(project, options)) {
    sheet.addRow(row)
  }

  sheet.getRow(1).font = { bold: true }
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}
