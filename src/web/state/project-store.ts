import { nanoid } from 'nanoid'
import { create } from 'zustand'
import type { CallCell, Project } from '@shared/types'

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
    get().commit(`call:${id}`, (current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === id ? { ...row, call } : row)),
    }))
  },
}))
