import { useEffect, useRef, useState } from 'react'
import type { LyricsResult, ProjectSummary, SongCandidate } from '@shared/types'
import { applyInterludeSlots, findInterludeSlots } from '@shared/interludes'
import { api } from '@web/api'
import { useProjectStore } from '@web/state/project-store'
import { nanoid } from 'nanoid'

export function ProjectList() {
  const load = useProjectStore((state) => state.load)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState<SongCandidate[]>([])
  const [pasteMode, setPasteMode] = useState(false)
  const [pasted, setPasted] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // 读不到列表和「一条都没有」是两件事，别都显示成「还没有项目」
  const refresh = async () => {
    setListLoading(true)
    try {
      setProjects(await api.listProjects())
      setListError('')
    } catch (cause) {
      setListError(cause instanceof Error ? cause.message : '读取项目列表失败')
    } finally {
      setListLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  const createFromResult = async (result: LyricsResult) => {
    const baseRows = result.lines.map((line) => ({ id: nanoid(), lyric: line.text, timeMs: line.timeMs }))
    const slots = findInterludeSlots(baseRows)
    const rows = applyInterludeSlots(baseRows, new Set(slots.map((slot) => slot.beforeId)))
    const project = await api.createProject({
      title: result.title || '未命名',
      artist: result.artist,
      album: result.album,
      durationMs: result.durationMs,
      source: { provider: result.provider, url: result.sourceUrl, fetchedAt: new Date().toISOString() },
      rows,
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

  const openProject = async (project: ProjectSummary) => {
    setOpeningId(project.id)
    setListError('')
    try {
      load(await api.getProject(project.id))
    } catch (cause) {
      setListError(cause instanceof Error ? cause.message : '打开项目失败')
    } finally {
      setOpeningId(null)
    }
  }

  const importXlsx = async (file: File) => {
    setBusy(true)
    setError('')
    try {
      await createFromResult(await api.importXlsx(file))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导入失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="project-list">
      <h1>Call Sheet</h1>
      <p className="muted">粘贴网易云或 QQ 音乐的分享链接，生成可编辑的 call 表。</p>

      <section className="notice" aria-label="关于间奏时间">
        <strong>关于间奏时间</strong>
        <p>
          自动识别出的间奏行，起点是「上一句歌词的起始时间」，会比真实间奏偏早。原因：LRC
          歌词只有每句的句首时间戳、没有行尾时间，而间奏要等上一句唱完才开始；网易云的逐字
          歌词字段目前在公开接口里不返回数据，无法做到精确到行尾。终点取下一句歌词的起始时间，基本准确。
        </p>
      </section>

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

      <div className="new-project-alt">
        <button className="btn btn-ghost" onClick={() => setPasteMode((value) => !value)}>
          {pasteMode ? '改用链接' : '抓取失败？粘贴歌词'}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          title="把只有歌词列的 xlsx 读成歌词行"
        >
          {busy ? '处理中…' : '导入表格（.xlsx）'}
        </button>
        <input
          ref={fileRef}
          className="visually-hidden"
          type="file"
          accept=".xlsx"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void importXlsx(file)
          }}
        />
      </div>

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
            <button
              key={candidate.songmid}
              className="btn btn-ghost"
              onClick={() => chooseCandidate(candidate)}
              disabled={busy}
            >
              {candidate.title} — {candidate.artist}
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <h2>已保存</h2>
      {listLoading && projects.length === 0 && <p className="muted">读取中…</p>}
      {listError && (
        <p className="error">
          {listError}{' '}
          <button className="btn btn-ghost" onClick={() => void refresh()}>重试</button>
        </p>
      )}
      {!listLoading && !listError && projects.length === 0 && <p className="muted">还没有项目</p>}
      {projects.map((project) => (
        <div key={project.id} className="project-row">
          <button
            className="project-card"
            onClick={() => void openProject(project)}
            disabled={openingId === project.id}
          >
            <strong>{project.title}</strong>
            <span>{project.artist}</span>
            <small>{openingId === project.id ? '打开中…' : `${project.rowCount} 行`}</small>
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
