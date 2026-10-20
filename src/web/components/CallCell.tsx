import type { CallCell as CallCellType } from '@shared/types'
import { applySubstitutions } from '@shared/substitute'

interface Props {
  call?: CallCellType
  variables: Record<string, string>
  onClick: () => void
  /** 块内的续行不再重复显示名称 */
  showLabel?: boolean
  /** 这块 call 覆盖了多行时，在角上标出「2/4」 */
  showSlot?: boolean
  slot?: number
  size?: number
}

export function CallCell({
  call,
  variables,
  onClick,
  showLabel = true,
  showSlot = false,
  slot = 0,
  size = 1,
}: Props) {
  if (!call) {
    return (
      <button className="call-cell call-empty" onClick={onClick}>
        ＋ 添加 call
      </button>
    )
  }

  const text = applySubstitutions(call.text, variables, call.overrides)

  return (
    <button className="call-cell" onClick={onClick}>
      {showLabel && call.label && <span className="call-label">{call.label}</span>}
      {showSlot && (
        <span className="call-slot" title="这一行是这个 call 的第几段">
          {slot + 1}/{size}
        </span>
      )}
      <span className="call-text">{text || <span className="call-blank">（这一段留空）</span>}</span>
    </button>
  )
}
