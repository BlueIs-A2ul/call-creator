import { useState } from 'react'
import { readCallGroups } from '@shared/call-groups'
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '@shared/types'
import { api, saveProjectWithRecovery } from '@web/api'
import { useEscapeKey } from '@web/hooks/useEscapeKey'
import { useProjectStore } from '@web/state/project-store'

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const project = useProjectStore((state) => state.project)!
  const markSaved = useProjectStore((state) => state.markSaved)
  const [options, setOptions] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const blockCount = readCallGroups(project.rows).filter((group) => group.rows.length > 1).length
  useEscapeKey(onClose)

  const toggle = (key: keyof ExportOptions) => setOptions((current) => ({ ...current, [key]: !current[key] }))

  const download = async () => {
    setBusy(true)
    setError('')
    try {
      const saved = await saveProjectWithRecovery(project)
      markSaved(saved)
      const blob = await api.exportXlsx(saved.id, options)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${saved.title}-call-sheet.xlsx`
      link.click()
      // 立刻 revoke 会让部分浏览器取消下载，等下载发起后再释放
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '导出失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="导出"
        onClick={(event) => event.stopPropagation()}
      >
        <h3>导出</h3>
        <label className="checkbox"><input type="checkbox" checked={options.mergeBlankRows} onChange={() => toggle('mergeBlankRows')} /> 空白行合并到上一行</label>
        <label className="checkbox"><input type="checkbox" checked={options.includeTags} onChange={() => toggle('includeTags')} /> 包含标签列</label>
        <label className="checkbox"><input type="checkbox" checked={options.includeNote} onChange={() => toggle('includeNote')} /> 包含备注列</label>
        <label className="checkbox"><input type="checkbox" checked={options.includeTime} onChange={() => toggle('includeTime')} /> 包含时间列</label>
        <label className="checkbox"><input type="checkbox" checked={options.applySubstitutions} onChange={() => toggle('applySubstitutions')} /> 应用占位符替换</label>
        {blockCount > 0 && (
          <p className="muted">
            有 {blockCount} 个跨行的 call，导出 xlsx 时它们的 Call 单元格会纵向合并成一格。
          </p>
        )}
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => window.print()}>打印 / 另存 PDF</button>
          <button className="btn btn-ghost" onClick={onClose}>关闭</button>
          <button className="btn btn-primary" onClick={download} disabled={busy}>{busy ? '导出中…' : '导出 xlsx'}</button>
        </div>
      </div>
    </div>
  )
}
