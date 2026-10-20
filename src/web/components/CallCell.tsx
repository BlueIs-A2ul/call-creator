import type { CallCell as CallCellType } from '@shared/types'
import { applySubstitutions } from '@shared/substitute'

interface Props {
  call?: CallCellType
  variables: Record<string, string>
  onClick: () => void
}

export function CallCell({ call, variables, onClick }: Props) {
  if (!call) {
    return (
      <button className="call-cell call-empty" onClick={onClick}>
        ＋ 添加 call
      </button>
    )
  }

  return (
    <button className="call-cell" onClick={onClick}>
      {call.label && <span className="call-label">{call.label}</span>}
      <span className="call-text">
        {applySubstitutions(call.text, variables, call.overrides)}
      </span>
    </button>
  )
}
