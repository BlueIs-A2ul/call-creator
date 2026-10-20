import { useEffect, useRef } from 'react'
import { saveProjectWithRecovery } from '@web/api'
import { useProjectStore } from '@web/state/project-store'

const MAX_ATTEMPTS = 3

export function useAutosave(enabled: boolean) {
  const project = useProjectStore((state) => state.project)
  const dirty = useProjectStore((state) => state.dirty)
  const markSaved = useProjectStore((state) => state.markSaved)
  const runningRef = useRef(false)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!enabled || !project || !dirty) return

    const run = async () => {
      // 同一时间只允许一个保存循环，避免两次 PUT 撞在同一个 revision 上
      if (runningRef.current) return
      runningRef.current = true
      try {
        for (;;) {
          const snapshot = useProjectStore.getState().project
          if (!snapshot) break
          const saved = await saveProjectWithRecovery(snapshot)
          const current = useProjectStore.getState().project
          if (!current || current === snapshot) {
            markSaved(saved)
            attemptsRef.current = 0
            break
          }
          // 保存期间又改过：同步 revision 后继续保存最新内容
          useProjectStore.setState({
            project: { ...current, revision: saved.revision },
            dirty: true,
          })
        }
      } catch (error) {
        console.error('自动保存失败', error)
        attemptsRef.current += 1
        if (attemptsRef.current < MAX_ATTEMPTS) {
          window.setTimeout(() => void run(), 3000)
        }
      } finally {
        runningRef.current = false
      }
    }

    const timer = window.setTimeout(() => void run(), 800)
    return () => window.clearTimeout(timer)
  }, [enabled, project, dirty, markSaved])
}
