import { useProjectStore } from '@web/state/project-store'
import { useAutosave } from '@web/hooks/useAutosave'
import { ProjectList } from '@web/components/ProjectList'
import { Toolbar } from '@web/components/Toolbar'

export default function App() {
  const project = useProjectStore((state) => state.project)
  useAutosave(Boolean(project))

  if (!project) return <ProjectList />

  return (
    <div className="app">
      <Toolbar
        project={project}
        onOpenLibrary={() => undefined}
        onOpenExport={() => undefined}
        onRefetch={() => undefined}
      />
      <p className="muted" style={{ padding: 16 }}>表格将在下一步接入。</p>
    </div>
  )
}
