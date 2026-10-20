import { useState } from 'react'
import type { Row } from '@shared/types'
import { formatClock, interludeBadgeFor } from '@shared/interludes'
import { useProjectStore } from '@web/state/project-store'
import { LyricCell } from './LyricCell'
import { CallCell } from './CallCell'
import { CallEditor } from './CallEditor'

export function SheetTable() {
  const project = useProjectStore((state) => state.project)!
  const updateLyric = useProjectStore((state) => state.updateLyric)
  const insertRow = useProjectStore((state) => state.insertRow)
  const deleteRows = useProjectStore((state) => state.deleteRows)
  const moveRow = useProjectStore((state) => state.moveRow)
  const [editing, setEditing] = useState<Row | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)

  return (
    <>
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
            {project.rows.map((row, index) => (
              <tr
                key={row.id}
                className={row.lyric ? '' : 'is-blank'}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) moveRow(dragIndex, index)
                  setDragIndex(null)
                }}
              >
                <td className="row-no">
                  <span>{index + 1}</span>
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
                  <button className="insert-btn" title="在下方插入空白行" onClick={() => insertRow(row.id)}>＋</button>
                  <button className="delete-btn" title="删除行" onClick={() => deleteRows([row.id])}>×</button>
                </td>
                <td>
                  <LyricCell value={row.lyric} onChange={(lyric) => updateLyric(row.id, lyric)} />
                </td>
                <td>
                  <CallCell call={row.call} variables={project.variables} onClick={() => setEditing(row)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <CallEditor row={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
