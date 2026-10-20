import type { Project } from '@shared/types'
import { useProjectStore } from '@web/state/project-store'

interface Props {
  project: Project
  onOpenLibrary: () => void
  onOpenExport: () => void
  onRefetch: () => void
}

export function Toolbar({ project, onOpenLibrary, onOpenExport, onRefetch }: Props) {
  const dirty = useProjectStore((state) => state.dirty)
  const undo = useProjectStore((state) => state.undo)
  const redo = useProjectStore((state) => state.redo)
  const updateTitle = useProjectStore((state) => state.updateTitle)

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <input
          className="title-input"
          value={project.title}
          placeholder="未命名"
          onChange={(event) => updateTitle(event.target.value)}
        />
        <span className="muted">{project.artist}</span>
      </div>
      <div className="toolbar-right">
        <span className={`save-status ${dirty ? 'is-dirty' : ''}`}>{dirty ? '保存中…' : '已保存'}</span>
        <button className="btn btn-ghost" onClick={undo}>撤销</button>
        <button className="btn btn-ghost" onClick={redo}>重做</button>
        <button className="btn btn-ghost" onClick={onRefetch}>重抓歌词</button>
        <button className="btn btn-ghost" onClick={onOpenLibrary}>词库</button>
        <button className="btn btn-primary" onClick={onOpenExport}>导出</button>
      </div>
    </header>
  )
}
