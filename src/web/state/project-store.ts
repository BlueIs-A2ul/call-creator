import { nanoid } from 'nanoid'
import { create } from 'zustand'
import { assignPhrasesToRows, extractCallPhrases, type CallSection } from '@shared/call-split'
import type { CallCell, Project } from '@shared/types'

export interface CallSource {
  label?: string
  tags: string[]
  sourceId?: string
  text: string
  section?: CallSection
}

interface ProjectState {
  project: Project | null
  past: Project[]
  future: Project[]
  dirty: boolean
  lastCommit: { key: string; at: number }
  load: (project: Project) => void
  clear: () => void
  commit: (key: string, mutator: (current: Project) => Project) => void
  undo: () => void
  redo: () => void
  markSaved: (project: Project) => void
  insertRow: (afterId: string | null) => void
  deleteRows: (ids: string[]) => void
  moveRow: (from: number, to: number) => void
  updateTitle: (title: string) => void
  updateLyric: (id: string, lyric: string) => void
  updateCall: (id: string, call: CallCell | undefined) => void
  /** 把词库里的一个 call 按顺序切给选中的行；连续的行合成一块 */
  applyCallToRows: (rowIds: string[], source: CallSource) => void
  /** 清掉这些行的 call（保留歌词行）；清掉块中间一行时，块会自然断成两块 */
  clearCalls: (rowIds: string[]) => void
  /** 把某一行从所在的 call 块里拆出来，其余行继续成块 */
  unlinkFromGroup: (id: string) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  past: [],
  future: [],
  dirty: false,
  lastCommit: { key: '', at: 0 },

  load: (project) => set({ project, past: [], future: [], dirty: false, lastCommit: { key: '', at: 0 } }),
  clear: () => set({ project: null, past: [], future: [], dirty: false }),

  commit: (key, mutator) => {
    const current = get().project
    if (!current) return
    const next = mutator(current)
    const now = Date.now()
    const coalesce = key !== '' && key === get().lastCommit.key && now - get().lastCommit.at < 500
    set({
      project: next,
      past: coalesce ? get().past : [...get().past, current].slice(-100),
      future: [],
      dirty: true,
      lastCommit: { key, at: now },
    })
  },

  undo: () => {
    const { past, project, future } = get()
    if (!project || past.length === 0) return
    const previous = past[past.length - 1]
    set({
      project: previous,
      past: past.slice(0, -1),
      future: [project, ...future].slice(0, 100),
      dirty: true,
      lastCommit: { key: '', at: 0 },
    })
  },

  redo: () => {
    const { past, project, future } = get()
    if (!project || future.length === 0) return
    const next = future[0]
    set({
      project: next,
      past: [...past, project].slice(-100),
      future: future.slice(1),
      dirty: true,
      lastCommit: { key: '', at: 0 },
    })
  },

  markSaved: (project) => set({ project, dirty: false }),

  insertRow: (afterId) => {
    get().commit('', (current) => {
      const index = afterId ? current.rows.findIndex((row) => row.id === afterId) : -1
      const row = { id: nanoid(), lyric: '' }
      const rows = [...current.rows]
      rows.splice(index + 1, 0, row)
      return { ...current, rows }
    })
  },

  deleteRows: (ids) => {
    const removing = new Set(ids)
    get().commit('', (current) => ({
      ...current,
      rows: current.rows.filter((row) => !removing.has(row.id)),
    }))
  },

  moveRow: (from, to) => {
    get().commit('', (current) => {
      if (from === to) return current
      const rows = [...current.rows]
      const [moved] = rows.splice(from, 1)
      rows.splice(to, 0, moved)
      return { ...current, rows }
    })
  },

  updateLyric: (id, lyric) => {
    get().commit(`lyric:${id}`, (current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === id ? { ...row, lyric } : row)),
    }))
  },

  updateTitle: (title) => {
    get().commit('title', (current) => ({ ...current, title }))
  },

  updateCall: (id, call) => {
    get().commit(`call:${id}`, (current) => {
      const groupId = call?.groupId
      return {
        ...current,
        rows: current.rows.map((row) => {
          if (row.id === id) return { ...row, call }
          // 名称/标签/备注在块内共享，改一处就同步整块；正文和占位符永远是这一行自己的
          if (groupId && row.call?.groupId === groupId) {
            return {
              ...row,
              call: {
                ...row.call,
                label: call?.label,
                tags: call?.tags ?? row.call.tags,
                sourceId: call?.sourceId,
                note: call?.note,
              },
            }
          }
          return row
        }),
      }
    })
  },

  applyCallToRows: (rowIds, source) => {
    const current = get().project
    if (!current || rowIds.length === 0) return

    const wanted = new Set(rowIds)
    const picked = current.rows
      .map((row, index) => ({ row, index }))
      .filter((item) => wanted.has(item.row.id))
    if (picked.length === 0) return

    const slices = assignPhrasesToRows(
      extractCallPhrases(source.text, source.section ?? 'romaji'),
      picked.length,
    )

    // 连续的行共用一个 groupId；被别的行隔开的选区自然落成两块
    const groupIds: string[] = []
    for (let index = 0; index < picked.length; index += 1) {
      const contiguous = index > 0 && picked[index].index === picked[index - 1].index + 1
      groupIds.push(contiguous ? groupIds[index - 1] : `g_${nanoid(8)}`)
    }

    const callByRow = new Map<string, CallCell>()
    picked.forEach(({ row }, index) => {
      callByRow.set(row.id, {
        label: source.label,
        tags: source.tags,
        sourceId: source.sourceId,
        text: slices[index],
        groupId: groupIds[index],
      })
    })

    get().commit('', (project) => ({
      ...project,
      rows: project.rows.map((row) => {
        const call = callByRow.get(row.id)
        return call ? { ...row, call } : row
      }),
    }))
  },

  clearCalls: (rowIds) => {
    if (rowIds.length === 0) return
    const removing = new Set(rowIds)
    get().commit('', (current) => ({
      ...current,
      rows: current.rows.map((row) => {
        if (!removing.has(row.id) || !row.call) return row
        return { id: row.id, lyric: row.lyric, timeMs: row.timeMs }
      }),
    }))
  },

  unlinkFromGroup: (id) => {
    get().commit('', (current) => ({
      ...current,
      rows: current.rows.map((row) => {
        if (row.id !== id || !row.call?.groupId) return row
        const { groupId: _groupId, ...rest } = row.call
        return { ...row, call: rest }
      }),
    }))
  },
}))
