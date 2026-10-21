import { useEffect, useMemo, useState } from 'react'
import type { LibraryEntry, Row } from '@shared/types'
import { formatClock, interludeBadgeFor } from '@shared/interludes'
import { callGroupIndex } from '@shared/call-groups'
import { useProjectStore } from '@web/state/project-store'
import { LyricCell } from './LyricCell'
import { CallCell } from './CallCell'
import { CallEditor } from './CallEditor'
import { LibraryDrawer } from './LibraryDrawer'

const TOAST_MS = 5000

export function SheetTable() {
  const project = useProjectStore((state) => state.project)!
  const updateLyric = useProjectStore((state) => state.updateLyric)
  const insertRow = useProjectStore((state) => state.insertRow)
  const deleteRows = useProjectStore((state) => state.deleteRows)
  const moveRow = useProjectStore((state) => state.moveRow)
  const applyCallToRows = useProjectStore((state) => state.applyCallToRows)
  const clearCalls = useProjectStore((state) => state.clearCalls)
  const undo = useProjectStore((state) => state.undo)
  const [editing, setEditing] = useState<Row | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [anchor, setAnchor] = useState<number | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const groups = useMemo(() => callGroupIndex(project.rows), [project.rows])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const selectedWithCall = useMemo(
    () => selected.filter((id) => project.rows.some((row) => row.id === id && row.call)),
    [selected, project.rows],
  )

  // 底部的「已删除…」提示几秒后自己消失
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  const selectRow = (index: number, event: React.MouseEvent) => {
    const rows = project.rows
    if (event.shiftKey && anchor !== null) {
      const [from, to] = anchor <= index ? [anchor, index] : [index, anchor]
      setSelected(rows.slice(from, to + 1).map((row) => row.id))
      return
    }
    const id = rows[index].id
    if (event.metaKey || event.ctrlKey) {
      setSelected((current) =>
        current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
      )
      setAnchor(index)
      return
    }
    setSelected((current) => (current.length === 1 && current[0] === id ? [] : [id]))
    setAnchor(index)
  }

  const pickCall = (entry: LibraryEntry) => {
    applyCallToRows([...selectedSet], {
      label: entry.filename,
      tags: entry.keywords,
      sourceId: entry.id,
      text: entry.text_content,
    })
    setSelected([])
    setPickerOpen(false)
  }

  const clearSelectedCalls = () => {
    const count = selectedWithCall.length
    clearCalls([...selectedSet])
    setSelected([])
    setToast(`已清除 ${count} 行的 call`)
  }

  const insertAfter = (id: string) => {
    const created = insertRow(id)
    // 新行还没渲染出来，等一帧再把焦点放进去
    if (created) {
      window.setTimeout(() => {
        document.querySelector<HTMLTextAreaElement>(`textarea[data-row="${created}"]`)?.focus()
      }, 0)
    }
  }

  const removeRow = (id: string) => {
    deleteRows([id])
    setToast('已删除 1 行歌词')
  }

  const clearOneCall = (id: string) => {
    clearCalls([id])
    setToast('已清除这一行的 call')
  }

  return (
    <>
      {selected.length > 0 && (
        <div className="selection-bar">
          <span>已选 {selected.length} 行</span>
          <button className="btn btn-primary" onClick={() => setPickerOpen(true)}>应用一个 call</button>
          <button
            className="btn btn-ghost"
            onClick={clearSelectedCalls}
            disabled={selectedWithCall.length === 0}
            title="只清掉 call，歌词行保留"
          >
            清除 call{selectedWithCall.length > 0 ? `（${selectedWithCall.length}）` : ''}
          </button>
          <button className="btn btn-ghost" onClick={() => setSelected([])}>取消选择</button>
          <span className="muted">
            {selected.length > 1
              ? '词条会按行切成几段，之后每行都能单独改'
              : '只选一行就是普通的整段 call'}
          </span>
        </div>
      )}

      <div className="sheet-wrap">
        <table className="sheet">
          <thead>
            <tr>
              <th className="col-no">#</th>
              <th className="col-lyric">歌词</th>
              <th className="col-call">Call</th>
            </tr>
          </thead>
          <tbody>
            {project.rows.map((row, index) => {
              const slotInfo = row.call?.groupId ? groups.get(row.id) : undefined
              const isGroupStart = Boolean(slotInfo && slotInfo.slot === 0)
              const className = [
                row.lyric ? '' : 'is-blank',
                slotInfo ? 'is-grouped' : '',
                isGroupStart ? 'is-group-start' : '',
                slotInfo && slotInfo.slot === slotInfo.size - 1 ? 'is-group-end' : '',
                selectedSet.has(row.id) ? 'is-selected' : '',
                dropIndex === index ? 'is-drop-target' : '',
              ]
                .filter(Boolean)
                .join(' ')

              return (
                <tr
                  key={row.id}
                  className={className}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    if (dropIndex !== index) setDropIndex(index)
                  }}
                  onDragLeave={() => setDropIndex((current) => (current === index ? null : current))}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== index) moveRow(dragIndex, index)
                    setDragIndex(null)
                    setDropIndex(null)
                  }}
                  onDragEnd={() => {
                    setDragIndex(null)
                    setDropIndex(null)
                  }}
                >
                  <td className="row-no">
                    <button className="row-pick" onClick={(event) => selectRow(index, event)} title="点一下选中这一行；Shift 连选；Ctrl 多选">
                      {index + 1}
                    </button>
                    {(() => {
                      const badge = interludeBadgeFor(project.rows, index)
                      if (!badge) return null
                      return (
                        <span
                          className="interlude-badge"
                          title="起点为上一句歌词的起始时间；间奏实际从上一句唱完开始，为近似值"
                        >
                          间奏 {formatClock(badge.startMs)}–{formatClock(badge.endMs)}
                        </span>
                      )
                    })()}
                    <div className="row-actions">
                      <button
                        className="row-action"
                        title="在下方插入空白行"
                        aria-label="在下方插入空白行"
                        onClick={() => insertAfter(row.id)}
                      >
                        ＋
                      </button>
                      <button
                        className="row-action"
                        title="删除行"
                        aria-label="删除行"
                        onClick={() => removeRow(row.id)}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                  <td>
                    <LyricCell
                      rowId={row.id}
                      value={row.lyric}
                      onChange={(lyric) => updateLyric(row.id, lyric)}
                    />
                  </td>
                  <td className="cell-call">
                    <CallCell
                      call={row.call}
                      variables={project.variables}
                      showLabel={!slotInfo || isGroupStart}
                      showSlot={Boolean(slotInfo && slotInfo.size > 1)}
                      slot={slotInfo?.slot ?? 0}
                      size={slotInfo?.size ?? 1}
                      onClick={() => setEditing(row)}
                    />
                    {row.call && (
                      <button
                        className="clear-call"
                        title={slotInfo && slotInfo.size > 1 ? '清除这一行的 call（整块要清就选中整块再点上方「清除 call」）' : '清除这一行的 call'}
                        aria-label="清除这一行的 call"
                        onClick={() => clearOneCall(row.id)}
                      >
                        清除
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing && <CallEditor row={editing} onClose={() => setEditing(null)} />}
      {pickerOpen && <LibraryDrawer onClose={() => setPickerOpen(false)} onPick={pickCall} />}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button
            className="btn btn-ghost"
            onClick={() => {
              undo()
              setToast(null)
            }}
          >
            撤销
          </button>
          <button className="btn btn-ghost" onClick={() => setToast(null)}>关闭</button>
        </div>
      )}
    </>
  )
}
