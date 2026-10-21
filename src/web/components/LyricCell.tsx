import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  /** 供「插入行后自动聚焦」定位用 */
  rowId?: string
}

export function LyricCell({ value, onChange, rowId }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = '0px'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      className="lyric-input"
      value={value}
      rows={1}
      data-row={rowId}
      placeholder="（空白行，可填写间奏 call）"
      onChange={(event) => onChange(event.target.value)}
    />
  )
}
