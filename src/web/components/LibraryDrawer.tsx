import { useEffect, useState } from 'react'
import type { LibraryEntry } from '@shared/types'
import { api } from '@web/api'

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

  const load = (force = false) => {
    api.library({ q: query, tags, refresh: force })
      .then((result) => {
        setEntries(result.entries)
        setAllTags(result.allTags)
        setStale(result.stale)
      })
      .catch((cause: Error) => setError(cause.message))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 250)
    return () => window.clearTimeout(timer)
  }, [query, tags])

  const toggleTag = (tag: string) => {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  return (
    <aside className="drawer">
      <div className="drawer-head">
        <h3>词库</h3>
        <div>
          <button className="btn btn-ghost" onClick={() => load(true)}>刷新</button>
          <button className="btn btn-ghost" onClick={onClose}>关闭</button>
        </div>
      </div>
      <input
        className="search"
        value={query}
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
        {entries.map((entry) => (
          <article key={entry.id} className="library-item">
            <header>
              <strong>{entry.filename}</strong>
              <small>{entry.keywords.join(' · ')}</small>
            </header>
            <pre>{entry.text_content.slice(0, 180)}</pre>
            {onPick && (
              <button className="btn btn-primary" onClick={() => { onPick(entry); onClose() }}>
                插入
              </button>
            )}
          </article>
        ))}
      </div>
    </aside>
  )
}
