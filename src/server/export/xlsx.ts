import ExcelJS from 'exceljs'
import { buildExportRows } from '@shared/export-map'
import type { ExportOptions, Project } from '@shared/types'

const CALL_COLUMN_WIDTH = 60
const ROW_UNIT_HEIGHT = 15

/** 中文字符按两个宽度算，用来估一块 call 需要几行才能显示完。 */
function displayWidth(line: string): number {
  let width = 0
  for (const char of line) width += char.codePointAt(0)! > 0x2e80 ? 2 : 1
  return width
}

function estimateHeight(text: string, columnWidth = CALL_COLUMN_WIDTH): number {
  const usable = Math.max(8, columnWidth - 2)
  const lines = text
    .split('\n')
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(displayWidth(line) / usable)), 0)
  return lines * ROW_UNIT_HEIGHT + 6
}

export async function writeXlsx(project: Project, options: ExportOptions): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'callCreator'
  const sheet = workbook.addWorksheet('Call Sheet')

  const columns: Array<{ header: string; key: string; width: number }> = [
    { header: '序号', key: 'no', width: 6 },
    { header: '歌词', key: 'lyric', width: 50 },
    { header: 'Call', key: 'call', width: CALL_COLUMN_WIDTH },
  ]
  if (options.includeTags) columns.push({ header: '标签', key: 'tags', width: 20 })
  if (options.includeNote) columns.push({ header: '备注', key: 'note', width: 24 })
  if (options.includeTime) columns.push({ header: '时间', key: 'time', width: 10 })

  sheet.columns = columns
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  const rows = buildExportRows(project, options)
  for (const row of rows) {
    sheet.addRow(row)
  }

  sheet.getRow(1).font = { bold: true }
  sheet.eachRow((row) => {
    row.alignment = { vertical: 'top', wrapText: true }
  })

  // 跨行的 call 合并成一格。Excel 不会自动给合并单元格调整行高，所以自己按内容估一个。
  const callColumn = columns.findIndex((column) => column.key === 'call') + 1
  rows.forEach((row, index) => {
    if (!row.span || row.span < 2) return
    const firstRow = index + 2
    const lastRow = firstRow + row.span - 1
    sheet.mergeCells(firstRow, callColumn, lastRow, callColumn)

    const perRow = Math.max(ROW_UNIT_HEIGHT, Math.ceil(estimateHeight(row.call) / row.span))
    for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber += 1) {
      sheet.getRow(rowNumber).height = perRow
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * ExcelJS 的 d.ts 自己声明了一个 `Buffer extends ArrayBuffer`，而运行时接受 Node Buffer，
 * 所以在读写工作簿的地方统一做一次类型转换。
 */
export function asExcelBuffer(data: Buffer): Parameters<ExcelJS.Workbook['xlsx']['load']>[0] {
  return data as unknown as Parameters<ExcelJS.Workbook['xlsx']['load']>[0]
}
