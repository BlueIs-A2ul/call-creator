import { useEffect, useState } from 'react'
import type { LyricsResult, ProjectSummary, SongCandidate } from '@shared/types'
import { api } from '@web/api'
import { useProjectStore } from '@web/state/project-store'
import { nanoid } from 'nanoid'

export function ProjectList() {
  const load = useProjectStore((state) => state.load)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState<SongCandidate[]>([])
  const [pasteMode, setPasteMode] = useState(false)
  const [pasted, setPasted] = useState('')

  const refresh = () => api.listProjects().then(setProjects).catch(() => setProjects([]))

  useEffect(() => {
    void refresh()
  }, [])

  const createFromResult = async (result: LyricsResult) => {
    const project = await api.createProject({
      title: result.title || '未命名',
      artist: result.artist,
      album: result.album,
      durationMs: result.durationMs,
      source: { provider: result.provider, url: result.sourceUrl, fetchedAt: new Date().toISOString() },
      rows: result.lines.map((line) => ({ id: nanoid(), lyric: line.text, timeMs: line.timeMs })),
    })
    load(project)
  }

  const start = async () => {
    setBusy(true)
    setError('')
    setCandidates([])
    try {
      const result = pasteMode
        ? await api.fetchLyrics({ text: pasted, provider: 'paste' })
        : await api.fetchLyrics({ url: input })
      if (result.candidates?.length) {
        setCandidates(result.candidates)
        return
      }
      await createFromResult(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '创建失败')
      setPasteMode(true)
    } finally {
      setBusy(false)
    }
  }

  const chooseCandidate = async (candidate: SongCandidate) => {
    setBusy(true)
    try {
      const result = await api.fetchLyrics({ provider: 'qq', songmid: candidate.songmid })
      await createFromResult(result)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '抓取失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="project-list">
      <h1>Call Sheet</h1>
      <p className="muted">粘贴网易云或 QQ 音乐的分享链接，生成可编辑的 call 表。</p>

      <div className="new-project">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="https://music.163.com/song?id=..."
          disabled={pasteMode}
        />
        <button className="btn btn-primary" onClick={start} disabled={busy || (!pasteMode && !input.trim())}>
          {busy ? '抓取中…' : '生成'}
        </button>
      </div>

      <button className="btn btn-ghost" onClick={() => setPasteMode((value) => !value)}>
        {pasteMode ? '改用链接' : '抓取失败？粘贴歌词'}
      </button>

      {pasteMode && (
        <textarea
          className="paste-area"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder="把 LRC 或纯文本歌词粘贴到这里"
        />
      )}

      {candidates.length > 0 && (
        <div className="candidates">
          <p>找到多首歌，请选择：</p>
          {candidates.map((candidate) => (
            <button key={candidate.songmid} className="btn btn-ghost" onClick={() => chooseCandidate(candidate)}>
              {candidate.title} — {candidate.artist}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <h2>已保存</h2>
      {projects.length === 0 && <p className="muted">还没有项目</p>}
      {projects.map((project) => (
        <div key={project.id} className="project-row">
          <button
            className="project-card"
            onClick={() => api.getProject(project.id).then(load)}
          >
            <strong>{project.title}</strong>
            <span>{project.artist}</span>
            <small>{project.rowCount} 行</small>
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              if (!window.confirm(`删除「${project.title}」？`)) return
              await api.deleteProject(project.id)
              await refresh()
            }}
          >
            删除
          </button>
        </div>
      ))}
    </div>
  )
}
