import { useState } from 'react'
import { useProjectStore } from '@web/state/project-store'
import { useAutosave } from '@web/hooks/useAutosave'
import { useHotkeys } from '@web/hooks/useHotkeys'
import { ProjectList } from '@web/components/ProjectList'
import { Toolbar } from '@web/components/Toolbar'
import { SheetTable } from '@web/components/SheetTable'
import { LibraryDrawer } from '@web/components/LibraryDrawer'
import { ExportDialog } from '@web/components/ExportDialog'
import { RefetchDialog } from '@web/components/RefetchDialog'
import { InterludeDialog } from '@web/components/InterludeDialog'

export default function App() {
  const project = useProjectStore((state) => state.project)
  const clear = useProjectStore((state) => state.clear)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [refetchOpen, setRefetchOpen] = useState(false)
  const [interludeOpen, setInterludeOpen] = useState(false)
  useAutosave(Boolean(project))
  useHotkeys(Boolean(project))

  const backToList = () => {
    const state = useProjectStore.getState()
    if (state.dirty && !window.confirm('还有改动没存完，确定返回列表？')) return
    clear()
  }

  if (!project) return <ProjectList />

  return (
    <div className="app">
      <Toolbar
        project={project}
        onBack={backToList}
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
