import { useEffect, useState } from 'react'
import type { LibraryEntry } from '@shared/types'
import { api } from '@web/api'
import { useEscapeKey } from '@web/hooks/useEscapeKey'

/** 词库有 300+ 条，一次全画出来是一面墙；先给一屏，需要再展开 */
const PAGE_SIZE = 30

interface Props {
  onPick?: (entry: LibraryEntry) => void
  onClose: () => void
}

export function LibraryDrawer({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [entries, setEntries] = useState<LibraryEntry[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [stale, setStale] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ filename: '', keywords: '', text_content: '' })
  useEscapeKey(onClose)

  const load = (force = false) => {
    setBusy(true)
    api.library({ q: query, tags, refresh: force })
      .then((result) => {
        setEntries(result.entries)
        setAllTags(result.allTags)
        setStale(result.stale)
        setError('')
        setLimit(PAGE_SIZE)
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setBusy(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250)
    return () => window.clearTimeout(timer)
  }, [query, tags])

  const toggleTag = (tag: string) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  const submitDraft = async () => {
    const filename = draft.filename.trim()
    const text = draft.text_content.trim()
    if (!filename || !text) {
      setError('名称和正文都要填')
      return
    }
    setBusy(true)
    try {
      await api.addLibraryEntry({
        filename,
        keywords: draft.keywords.split(/[,，\s]+/).map((tag) => tag.trim()).filter(Boolean),
        text_content: text,
      })
      setDraft({ filename: '', keywords: '', text_content: '' })
      setAdding(false)
      load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败')
      setBusy(false)
    }
  }

  const removeEntry = async (entry: LibraryEntry) => {
    if (!window.confirm(`删除自建词条「${entry.filename}」？`)) return
    setBusy(true)
    try {
      await api.deleteLibraryEntry(entry.id)
      load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除失败')
      setBusy(false)
    }
  }

  return (
    <aside className="drawer" role="dialog" aria-modal="false" aria-label="词库">
      <div className="drawer-head">
        <h3>词库</h3>
        <div>
          <button className="btn btn-ghost" onClick={() => setAdding((value) => !value)}>
            {adding ? '收起新建' : '新建词条'}
          </button>
          <button className="btn btn-ghost" onClick={() => load(true)} disabled={busy}>
            {busy ? '刷新中…' : '刷新'}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>关闭</button>
        </div>
      </div>

      {adding && (
        <div className="library-new">
          <input
            value={draft.filename}
            onChange={(event) => setDraft({ ...draft, filename: event.target.value })}
            placeholder="名称，例如：首推call"
          />
          <input
            value={draft.keywords}
            onChange={(event) => setDraft({ ...draft, keywords: event.target.value })}
            placeholder="标签，逗号或空格分隔"
          />
          <textarea
            value={draft.text_content}
            onChange={(event) => setDraft({ ...draft, text_content: event.target.value })}
            placeholder="词条正文（罗马字那一段）"
          />
          <button className="btn btn-primary" onClick={() => void submitDraft()} disabled={busy}>
            {busy ? '保存中…' : '保存到词库'}
          </button>
        </div>
      )}

      <input
        className="search"
        value={query}
        autoFocus
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索名称、标签、正文"
      />
      <div className="tag-list">
        {allTags.map((tag) => (
          <button
            key={tag}
            className={`tag ${tags.includes(tag) ? 'is-active' : ''}`}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      {stale && <p className="muted">词库缓存可能不是最新</p>}
      {error && <p className="error">{error}</p>}
      <div className="library-list">
        {entries.slice(0, limit).map((entry) => (
          <article key={entry.id} className="library-item">
            <header>
              <strong>{entry.filename}</strong>
              <small>{entry.keywords.join(' · ')}</small>
            </header>
            <pre>{entry.text_content.slice(0, 180)}</pre>
            <div className="library-actions">
              {onPick && (
                <button className="btn btn-primary" onClick={() => { onPick(entry); onClose() }}>
                  插入
                </button>
              )}
              {entry.origin === 'user' && (
                <button
                  className="btn btn-ghost danger-text"
                  title="删除这条自建词条"
                  onClick={() => void removeEntry(entry)}
                >
                  删除
                </button>
              )}
            </div>
          </article>
        ))}
        {entries.length === 0 && !busy && !error && (
          <p className="muted">没有匹配的词条，换个关键词或标签试试。</p>
        )}
        {entries.length > limit && (
          <button className="btn btn-ghost" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
            显示更多（还有 {entries.length - limit} 条）
          </button>
        )}
      </div>
    </aside>
  )
}
