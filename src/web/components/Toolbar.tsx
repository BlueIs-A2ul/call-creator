import type { Project } from '@shared/types'
import { useProjectStore } from '@web/state/project-store'

interface Props {
  project: Project
  onBack: () => void
  onOpenLibrary: () => void
  onOpenExport: () => void
  onRefetch: () => void
  onOpenInterlude: () => void
}

export function Toolbar({ project, onBack, onOpenLibrary, onOpenExport, onRefetch, onOpenInterlude }: Props) {
  const dirty = useProjectStore((state) => state.dirty)
  const saveStatus = useProjectStore((state) => state.saveStatus)
  const saveError = useProjectStore((state) => state.saveError)
  const canUndo = useProjectStore((state) => state.past.length > 0)
  const canRedo = useProjectStore((state) => state.future.length > 0)
  const undo = useProjectStore((state) => state.undo)
  const redo = useProjectStore((state) => state.redo)
  const requestSave = useProjectStore((state) => state.requestSave)
  const updateTitle = useProjectStore((state) => state.updateTitle)

  const failed = saveStatus === 'error'
  const statusText = failed ? '保存失败' : dirty || saveStatus === 'saving' ? '保存中…' : '已保存'

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <button className="btn btn-ghost back-btn" onClick={onBack} title="返回项目列表">
          ← 列表
        </button>
        <input
          className="title-input"
          value={project.title}
          placeholder="未命名"
          onChange={(event) => updateTitle(event.target.value)}
        />
        <span className="muted">{project.artist}</span>
      </div>
      <div className="toolbar-right">
        <span
          className={`save-status ${failed ? 'is-error' : dirty ? 'is-dirty' : ''}`}
          role="status"
          aria-live="polite"
          title={failed ? saveError : undefined}
        >
          {statusText}
        </span>
        {failed && (
          <button className="btn btn-ghost danger-text" onClick={requestSave} title={saveError || '重新保存'}>
            重试
          </button>
        )}
        <button className="btn btn-ghost" onClick={undo} disabled={!canUndo} title="撤销（Ctrl+Z）">撤销</button>
        <button className="btn btn-ghost" onClick={redo} disabled={!canRedo} title="重做（Ctrl+Shift+Z）">重做</button>
        <button className="btn btn-ghost" onClick={onRefetch}>重抓歌词</button>
        <button className="btn btn-ghost" onClick={onOpenInterlude}>识别间奏</button>
        <button className="btn btn-ghost" onClick={onOpenLibrary}>词库</button>
        <button className="btn btn-primary" onClick={onOpenExport}>导出</button>
      </div>
    </header>
  )
}
