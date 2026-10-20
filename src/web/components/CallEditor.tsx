import { useState } from 'react'
import { findCallGroup } from '@shared/call-groups'
import { findPlaceholders } from '@shared/substitute'
import type { CallCell, Row } from '@shared/types'
import { useProjectStore } from '@web/state/project-store'
import { LibraryDrawer } from './LibraryDrawer'

interface Props {
  row: Row
  onClose: () => void
}

export function CallEditor({ row, onClose }: Props) {
  const project = useProjectStore((state) => state.project)!
  const updateCall = useProjectStore((state) => state.updateCall)
  const unlinkFromGroup = useProjectStore((state) => state.unlinkFromGroup)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [call, setCall] = useState<CallCell>(
    row.call ?? { text: '', tags: [] },
  )

  const tokens = findPlaceholders(call.text)
  const slotInfo = findCallGroup(project.rows, row.id)
  const grouped = Boolean(slotInfo && slotInfo.size > 1)

  const save = () => {
    updateCall(row.id, call.text.trim() ? call : undefined)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>编辑 Call</h3>
        {grouped && (
          <p className="group-hint">
            这是「{slotInfo!.group.rows[0].call?.label ?? '未命名'}」的第 {slotInfo!.slot + 1}/
            {slotInfo!.size} 段：改名称或标签会同步整块，改正文只影响这一行。
          </p>
        )}
        <label>
          名称
          <input
            value={call.label ?? ''}
            onChange={(event) => setCall({ ...call, label: event.target.value })}
            placeholder="例如：首推call"
          />
        </label>
        <label>
          正文
          <button className="btn btn-ghost" onClick={() => setLibraryOpen(true)}>从词库选择</button>
          <textarea
            className="call-textarea"
            value={call.text}
            onChange={(event) => setCall({ ...call, text: event.target.value })}
            placeholder="可以粘贴词条，也可以自由填写"
          />
        </label>
        <label>
          标签（逗号分隔）
          <input
            value={call.tags.join(', ')}
            onChange={(event) =>
              setCall({
                ...call,
                tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
              })
            }
          />
        </label>
        {tokens.length > 0 && (
          <div className="token-list">
            <span className="muted">占位符（留空则保留原样）：</span>
            {tokens.map((token) => (
              <label key={token} className="token-item">
                {token}
                <input
                  value={project.variables[token] ?? ''}
                  onChange={(event) => {
                    const variables = { ...project.variables, [token]: event.target.value }
                    useProjectStore.setState({ project: { ...project, variables }, dirty: true })
                  }}
                />
              </label>
            ))}
          </div>
        )}
        <div className="modal-actions">
          {grouped && (
            <button
              className="btn btn-ghost"
              title="这一行变成独立的 call，其余行继续成块"
              onClick={() => {
                unlinkFromGroup(row.id)
                onClose()
              }}
            >
              拆出这一行
            </button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={save}>保存</button>
        </div>
        {libraryOpen && (
          <LibraryDrawer
            onClose={() => setLibraryOpen(false)}
            onPick={(entry) => {
              setCall((current) => ({
                ...current,
                label: entry.filename,
                tags: entry.keywords,
                sourceId: entry.id,
                text: current.text ? `${current.text}\n${entry.text_content}` : entry.text_content,
              }))
            }}
          />
        )}
      </div>
    </div>
  )
}
