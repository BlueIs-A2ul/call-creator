import { useEffect, useRef } from 'react'

/**
 * 所有弹层共用一个 Esc 监听：只关最上面那一层。
 * 否则 CallEditor 里再开词库抽屉时，一次 Esc 会把两个都关掉。
 */
const stack: Array<() => void> = []
let listening = false

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  const top = stack[stack.length - 1]
  if (!top) return
  event.preventDefault()
  event.stopPropagation()
  top()
}

function ensureListener() {
  if (listening) return
  window.addEventListener('keydown', onKeyDown, true)
  listening = true
}

export function useEscapeKey(onEscape: () => void, enabled = true) {
  const callbackRef = useRef(onEscape)
  callbackRef.current = onEscape

  useEffect(() => {
    if (!enabled) return
    const handler = () => callbackRef.current()
    stack.push(handler)
    ensureListener()
    return () => {
      const index = stack.lastIndexOf(handler)
      if (index >= 0) stack.splice(index, 1)
    }
  }, [enabled])
}
