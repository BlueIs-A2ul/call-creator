import { useMemo, useState } from 'react'
import { DEFAULT_MIN_GAP_MS, applyInterludeSlots, findInterludeSlots, formatClock } from '@shared/interludes'
import { useEscapeKey } from '@web/hooks/useEscapeKey'
import { useProjectStore } from '@web/state/project-store'

function gapSeconds(gapMs: number): number {
  return Math.round(gapMs / 1000)
}

export function InterludeDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((state) => state.project)!
  const commit = useProjectStore((state) => state.commit)
  const [minGapSec, setMinGapSec] = useState(DEFAULT_MIN_GAP_MS / 1000)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  useEscapeKey(onClose)

  const slots = useMemo(
    () => findInterludeSlots(project.rows, minGapSec * 1000),
    [project.rows, minGapSec],
  )
  const chosen = slots.filter((slot) => !excluded.has(slot.beforeId))
  const timestamps = project.rows.filter((row) => row.lyric && row.timeMs != null)

  const toggle = (beforeId: string) => {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(beforeId)) next.delete(beforeId)
      else next.add(beforeId)
      return next
    })
  }

  const apply = () => {
    if (chosen.length === 0) {
      onClose()
      return
    }
    commit('', (current) => ({
      ...current,
      rows: applyInterludeSlots(current.rows, new Set(chosen.map((slot) => slot.beforeId))),
    }))
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="识别间奏"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>识别间奏</h3>
        {timestamps.length === 0 ? (
          <p className="muted">
            这些歌词没有时间戳（纯文本粘贴或表格导入），无法识别间奏。用链接抓取歌词后重试。
          </p>
        ) : (
          <>
            <label>
              最小间隔（秒）
              <input
                type="number"
                min={3}
                max={60}
                step={1}
                value={minGapSec}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (Number.isFinite(value)) setMinGapSec(Math.min(60, Math.max(3, Math.round(value))))
                }}
              />
            </label>

            {slots.length === 0 ? (
              <p className="muted">没有检测到间奏（当前最小间隔 {minGapSec} 秒）。</p>
            ) : (
              <ul className="interlude-list">
                {slots.map((slot) => (
                  <li key={slot.beforeId}>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={!excluded.has(slot.beforeId)}
                        onChange={() => toggle(slot.beforeId)}
                      />
                      <span>
                        间奏 {formatClock(slot.startMs)}–{formatClock(slot.endMs)}（约 {gapSeconds(slot.gapMs)} 秒）
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>取消</button>
              <button className="btn btn-primary" onClick={apply} disabled={chosen.length === 0}>
                插入间奏行
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
