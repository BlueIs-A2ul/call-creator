import { useCallback, useEffect, useRef } from 'react'
import { saveProjectKeepalive, saveProjectWithRecovery } from '@web/api'
import { useProjectStore } from '@web/state/project-store'

const MAX_ATTEMPTS = 3
const DEBOUNCE_MS = 800
const RETRY_BASE_MS = 3000

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '保存失败'
}

export function useAutosave(enabled: boolean) {
  const project = useProjectStore((state) => state.project)
  const dirty = useProjectStore((state) => state.dirty)
  const saveNonce = useProjectStore((state) => state.saveNonce)
  const runningRef = useRef(false)
  const attemptsRef = useRef(0)
  const retryTimerRef = useRef<number | null>(null)
  const seenNonceRef = useRef(saveNonce)

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }, [])

  const run = useCallback(async () => {
    // 同一时间只允许一个保存循环，避免两次 PUT 撞在同一个 revision 上
    if (runningRef.current) return
    if (!useProjectStore.getState().project) return
    runningRef.current = true
    useProjectStore.getState().markSaving()
    try {
      for (;;) {
        const snapshot = useProjectStore.getState().project
        if (!snapshot) break
        const saved = await saveProjectWithRecovery(snapshot)
        const current = useProjectStore.getState().project
        if (!current || current === snapshot) {
          useProjectStore.getState().markSaved(saved)
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
      useProjectStore.getState().markSaveFailed(messageOf(error))
      if (attemptsRef.current < MAX_ATTEMPTS) {
        retryTimerRef.current = window.setTimeout(() => {
          retryTimerRef.current = null
          void run()
        }, RETRY_BASE_MS * attemptsRef.current)
      }
    } finally {
      runningRef.current = false
    }
  }, [])

  // 改动后防抖保存；每次重新编辑都重新给一份重试预算
  useEffect(() => {
    if (!enabled || !project || !dirty) return
    clearRetry()
    attemptsRef.current = 0
    const timer = window.setTimeout(() => void run(), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [enabled, project, dirty, run, clearRetry])

  // Ctrl+S 与「重试」按钮：立刻保存一次，并把退避计数清零
  useEffect(() => {
    if (!enabled || saveNonce === seenNonceRef.current) return
    seenNonceRef.current = saveNonce
    clearRetry()
    attemptsRef.current = 0
    void run()
  }, [enabled, saveNonce, run, clearRetry])

  // 关标签/切后台时兜底：keepalive 请求不随文档销毁被取消
  useEffect(() => {
    if (!enabled) return

    const flush = () => {
      const state = useProjectStore.getState()
      if (!state.project || !state.dirty) return
      void saveProjectKeepalive(state.project)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    // 正常输入不该被弹窗打扰：只有保存真的失败了才拦一下
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const state = useProjectStore.getState()
      if (state.dirty && state.saveStatus === 'error') {
        event.preventDefault()
        event.returnValue = ''
      }
    }

    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [enabled])

  useEffect(() => clearRetry, [clearRetry])
}
