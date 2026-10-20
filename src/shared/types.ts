export type ProviderId = 'netease' | 'qq' | 'paste' | 'xlsx'

export interface CallCell {
  label?: string
  text: string
  tags: string[]
  sourceId?: string
  overrides?: Record<string, string>
  note?: string
}

export interface Row {
  id: string
  lyric: string
  timeMs?: number
  call?: CallCell
}

export interface LibraryEntry {
  id: string
  filename: string
  keywords: string[]
  text_content: string
  link?: string
  last_updated?: string
  origin: 'builtin' | 'user'
  hidden?: boolean
}

export interface Project {
  schemaVersion: 1
  id: string
  title: string
  artist: string
  album?: string
  durationMs?: number
  source?: {
    provider: ProviderId
    url?: string
    fetchedAt: string
  }
  rows: Row[]
  variables: Record<string, string>
  librarySnapshot?: LibraryEntry[]
  revision: number
  createdAt: string
  updatedAt: string
}

export interface LyricLine {
  text: string
  timeMs?: number
}

export interface SongCandidate {
  songmid: string
  title: string
  artist: string
}

export interface LyricsResult {
  provider: ProviderId
  title: string
  artist: string
  album?: string
  durationMs?: number
  lines: LyricLine[]
  raw: string
  warnings: string[]
  sourceUrl?: string
  candidates?: SongCandidate[]
}

export interface ProjectSummary {
  id: string
  title: string
  artist: string
  updatedAt: string
  rowCount: number
}

export interface ExportOptions {
  mergeBlankRows: boolean
  includeTags: boolean
  includeNote: boolean
  includeTime: boolean
  applySubstitutions: boolean
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  mergeBlankRows: false,
  includeTags: false,
  includeNote: false,
  includeTime: false,
  applySubstitutions: false,
}
