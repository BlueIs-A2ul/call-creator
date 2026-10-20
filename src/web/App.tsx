import { useState } from 'react'
import { useProjectStore } from '@web/state/project-store'
import { useAutosave } from '@web/hooks/useAutosave'
import { ProjectList } from '@web/components/ProjectList'
import { Toolbar } from '@web/components/Toolbar'
import { SheetTable } from '@web/components/SheetTable'
import { LibraryDrawer } from '@web/components/LibraryDrawer'
import { ExportDialog } from '@web/components/ExportDialog'
import { RefetchDialog } from '@web/components/RefetchDialog'
import { InterludeDialog } from '@web/components/InterludeDialog'

export default function App() {
  const project = useProjectStore((state) => state.project)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [refetchOpen, setRefetchOpen] = useState(false)
  const [interludeOpen, setInterludeOpen] = useState(false)
  useAutosave(Boolean(project))

  if (!project) return <ProjectList />

  return (
    <div className="app">
      <Toolbar
        project={project}
        onOpenLibrary={() => setLibraryOpen(true)}
        onOpenExport={() => setExportOpen(true)}
        onRefetch={() => setRefetchOpen(true)}
        onOpenInterlude={() => setInterludeOpen(true)}
      />
      <SheetTable />
      {libraryOpen && <LibraryDrawer onClose={() => setLibraryOpen(false)} />}
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
      {refetchOpen && <RefetchDialog onClose={() => setRefetchOpen(false)} />}
      {interludeOpen && <InterludeDialog onClose={() => setInterludeOpen(false)} />}
    </div>
  )
}
