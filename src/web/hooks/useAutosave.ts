import { useEffect } from 'react'
import { api } from '@web/api'
import { useProjectStore } from '@web/state/project-store'

export function useAutosave(enabled: boolean) {
  const project = useProjectStore((state) => state.project)
  const dirty = useProjectStore((state) => state.dirty)
  const markSaved = useProjectStore((state) => state.markSaved)

  useEffect(() => {
    if (!enabled || !project || !dirty) return
    const timer = window.setTimeout(async () => {
      try {
        const saved = await api.saveProject(project)
        const current = useProjectStore.getState().project
        if (current && current !== project) {
          useProjectStore.setState({
            project: { ...current, revision: saved.revision },
            dirty: true,
          })
        } else {
          markSaved(saved)
        }
      } catch (error) {
        console.error('自动保存失败', error)
      }
    }, 800)
    return () => window.clearTimeout(timer)
  }, [enabled, project, dirty, markSaved])
}
