import { useState } from 'react'
import { useProjectStore } from '@web/state/project-store'
import { useAutosave } from '@web/hooks/useAutosave'
import { ProjectList } from '@web/components/ProjectList'
import { Toolbar } from '@web/components/Toolbar'
import { SheetTable } from '@web/components/SheetTable'
import { LibraryDrawer } from '@web/components/LibraryDrawer'

export default function App() {
  const project = useProjectStore((state) => state.project)
  const [libraryOpen, setLibraryOpen] = useState(false)
  useAutosave(Boolean(project))

  if (!project) return <ProjectList />

  return (
    <div className="app">
      <Toolbar
        project={project}
        onOpenLibrary={() => setLibraryOpen(true)}
        onOpenExport={() => undefined}
        onRefetch={() => undefined}
      />
      <SheetTable />
      {libraryOpen && <LibraryDrawer onClose={() => setLibraryOpen(false)} />}
    </div>
  )
}
