import { readCallGroups, type CallGroup } from './call-groups'
import { applySubstitutions } from './substitute'
import type { ExportOptions, Project, Row } from './types'

export interface ExportRow {
  no: number | ''
  lyric: string
  call: string
  tags: string
  note: string
  time: string
  /** 本行的 call 与上一行同属一块，导出时纵向合并，内容只写在块首 */
  mergeUp?: boolean
  /** 块首行：call 单元格向下合并的行数（含自己）；1 表示不合并 */
  span?: number
}

export function formatTime(timeMs: number): string {
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((timeMs % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function rowCallText(project: Project, options: ExportOptions, row: Row): string {
  const call = row.call
  if (!call) return ''
  const text = options.applySubstitutions
    ? applySubstitutions(call.text, project.variables, call.overrides)
    : call.text
  return [call.label, text].filter(Boolean).join('\n')
}

/** 一个块的整体文本：名称写一次，下面按行把各段接起来。 */
function blockText(project: Project, options: ExportOptions, group: CallGroup): string {
  const label = group.rows[0].call?.label
  const body = group.rows
    .map((row) => {
      const call = row.call
      if (!call) return ''
      const text = options.applySubstitutions
        ? applySubstitutions(call.text, project.variables, call.overrides)
        : call.text
      return text.trim()
    })
    .filter(Boolean)
    .join('\n')
  return [label, body].filter(Boolean).join('\n')
}

export function buildExportRows(project: Project, options: ExportOptions): ExportRow[] {
  const groupOf = new Map<string, CallGroup>()
  for (const group of readCallGroups(project.rows)) {
    for (const row of group.rows) groupOf.set(row.id, group)
  }

  const result: ExportRow[] = []
  const blocks: Array<{ head: ExportRow; count: number }> = []
  let no = 1
  let previous: ExportRow | null = null
  let openBlock: { head: ExportRow; count: number } | null = null

  for (const row of project.rows) {
    const group = row.call?.groupId ? (groupOf.get(row.id) ?? null) : null
    const isBlockHead = Boolean(group && group.rows[0].id === row.id)
    const isBlockTail = Boolean(group && !isBlockHead)

    // 空白行并入上一行（（间奏））。组内的行不能折叠，否则合并单元格就断了。
    if (!row.lyric && options.mergeBlankRows && previous && !group) {
      // 上一行是合并块的续行时，内容得写到块首去，写续行等于写进被合并掉的单元格
      const target = previous.mergeUp && openBlock ? openBlock.head : previous
      const extra = rowCallText(project, options, row)
      target.call = [target.call, '（间奏）', extra].filter(Boolean).join('\n')
      const tags = row.call?.tags.join(' / ') ?? ''
      const note = row.call?.note ?? ''
      if (options.includeTags && tags) target.tags = [target.tags, tags].filter(Boolean).join('\n')
      if (options.includeNote && note) target.note = [target.note, note].filter(Boolean).join('\n')
      continue
    }

    let call: string
    if (isBlockHead) call = blockText(project, options, group!)
    else if (isBlockTail) call = ''
    else call = rowCallText(project, options, row)

    const exported: ExportRow = {
      no: row.lyric || !options.mergeBlankRows ? no++ : '',
      lyric: row.lyric,
      call,
      tags: isBlockTail ? '' : (row.call?.tags.join(' / ') ?? ''),
      note: isBlockTail ? '' : (row.call?.note ?? ''),
      time: options.includeTime && row.timeMs ? formatTime(row.timeMs) : '',
    }
    if (isBlockTail) exported.mergeUp = true

    result.push(exported)
    previous = exported

    if (isBlockHead) {
      openBlock = { head: exported, count: 0 }
      blocks.push(openBlock)
    } else if (isBlockTail && openBlock) {
      openBlock.count += 1
    } else {
      openBlock = null
    }
  }

  for (const block of blocks) {
    if (block.count > 0) block.head.span = block.count + 1
  }

  return result
}
