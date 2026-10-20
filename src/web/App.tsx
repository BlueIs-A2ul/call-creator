import { useProjectStore } from '@web/state/project-store'
import { useAutosave } from '@web/hooks/useAutosave'
import { ProjectList } from '@web/components/ProjectList'
import { Toolbar } from '@web/components/Toolbar'
import { SheetTable } from '@web/components/SheetTable'

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
      <SheetTable />
    </div>
  )
}
