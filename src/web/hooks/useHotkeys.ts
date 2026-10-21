import { useEffect } from 'react'
import { useProjectStore } from '@web/state/project-store'

/** 弹层（CallEditor / 导出 / 词库…）里的输入框保留浏览器原生撤销，不动整个项目的历史 */
const OVERLAY_SELECTOR = '.modal, .drawer'

function insideOverlay(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(OVERLAY_SELECTOR) !== null
}

/** Ctrl/Cmd+Z 撤销、Ctrl/Cmd+Shift+Z 或 Ctrl+Y 重做、Ctrl/Cmd+S 立刻保存 */
export function useHotkeys(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      if (insideOverlay(event.target)) return
      const key = event.key.toLowerCase()
      const store = useProjectStore.getState()

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault()
        store.undo()
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault()
        store.redo()
      } else if (key === 's') {
        event.preventDefault()
        store.requestSave()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
