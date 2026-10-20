import { applySubstitutions } from './substitute'
import type { ExportOptions, Project } from './types'

export interface ExportRow {
  no: number | ''
  lyric: string
  call: string
  tags: string
  note: string
  time: string
}

export function formatTime(timeMs: number): string {
  const totalSeconds = Math.floor(timeMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const centiseconds = Math.floor((timeMs % 1000) / 10)
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`
}

function callText(project: Project, options: ExportOptions, index: number): string {
  const call = project.rows[index].call
  if (!call) return ''
  const text = options.applySubstitutions
    ? applySubstitutions(call.text, project.variables, call.overrides)
    : call.text
  return [call.label, text].filter(Boolean).join('\n')
}

export function buildExportRows(project: Project, options: ExportOptions): ExportRow[] {
  const result: ExportRow[] = []
  let no = 1
  let previous: ExportRow | null = null

  project.rows.forEach((row, index) => {
    const call = callText(project, options, index)
    const tags = row.call?.tags.join(' / ') ?? ''
    const note = row.call?.note ?? ''

    if (!row.lyric && options.mergeBlankRows && previous) {
      previous.call = [previous.call, '（间奏）', call].filter(Boolean).join('\n')
      if (options.includeTags && tags) previous.tags = [previous.tags, tags].filter(Boolean).join('\n')
      if (options.includeNote && note) previous.note = [previous.note, note].filter(Boolean).join('\n')
      return
    }

    const exported: ExportRow = {
      no: row.lyric || !options.mergeBlankRows ? no++ : '',
      lyric: row.lyric,
      call,
      tags,
      note,
      time: options.includeTime && row.timeMs ? formatTime(row.timeMs) : '',
    }
    result.push(exported)
    previous = exported
  })

  return result
}
