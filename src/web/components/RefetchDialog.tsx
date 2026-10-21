import { useState } from 'react'
import { mergeRows } from '@shared/merge-rows'
import type { LyricsResult, Row } from '@shared/types'
import { api } from '@web/api'
import { useEscapeKey } from '@web/hooks/useEscapeKey'
import { useProjectStore } from '@web/state/project-store'

export function RefetchDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((state) => state.project)!
  const commit = useProjectStore((state) => state.commit)
  const [url, setUrl] = useState(project.source?.url ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ rows: Row[]; cleanRows: Row[]; orphans: Row[] } | null>(null)
  useEscapeKey(onClose)

  const fetchLyrics = async () => {
    setBusy(true)
    setError('')
    try {
      const lyrics: LyricsResult = await api.fetchLyrics({ url })
      setResult(mergeRows(project.rows, lyrics.lines))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '抓取失败')
    } finally {
      setBusy(false)
    }
  }

  const apply = (keepOrphans: boolean) => {
    if (!result) return
    commit('', (current) => ({
      ...current,
      rows: keepOrphans ? result.rows : result.cleanRows,
    }))
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="重新抓取歌词"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>重新抓取歌词</h3>
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="歌曲链接" />
        <button className="btn btn-ghost" onClick={fetchLyrics} disabled={busy}>{busy ? '抓取中…' : '抓取'}</button>
        {error && <p className="error">{error}</p>}
        {result && (
          <div>
            <p>新歌词 {result.rows.length} 行，找不到归属的旧 call {result.orphans.length} 条。</p>
            {result.orphans.length > 0 && (
              <>
                <ul>
                  {result.orphans.map((row) => <li key={row.id}>{row.call?.text.slice(0, 40)}</li>)}
                </ul>
                <p className="muted">
                  「保留为空白行」会把这些 call 挂在新歌词后面，之后可以手动挪位置。
                </p>
              </>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>取消</button>
              {result.orphans.length > 0 && (
                <button className="btn btn-ghost" onClick={() => apply(false)}>丢弃旧 call</button>
              )}
              <button className="btn btn-primary" onClick={() => apply(true)}>保留为空白行</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
