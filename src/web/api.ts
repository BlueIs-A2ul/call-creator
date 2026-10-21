import type { ExportOptions, LibraryEntry, LyricsResult, Project, ProjectSummary } from '@shared/types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...((init?.headers as Record<string, string> | undefined) ?? {}) }
  // 只有带 body 的请求才声明 JSON；空 body 的 DELETE/GET 带上 application/json
  // 会被 Fastify 以 FST_ERR_CTP_EMPTY_JSON_BODY 拒绝
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(body?.message ?? `请求失败（${response.status}）`)
  }
  return response.json() as Promise<T>
}

export const api = {
  listProjects: () => request<ProjectSummary[]>('/api/projects'),
  getProject: (id: string) => request<Project>(`/api/projects/${id}`),
  createProject: (input: {
    title: string
    artist: string
    album?: string
    durationMs?: number
    rows: Array<{ id?: string; lyric: string; timeMs?: number }>
    source?: Project['source']
  }) => request<Project>('/api/projects', { method: 'POST', body: JSON.stringify(input) }),
  saveProject: (project: Project) =>
    request<Project>(`/api/projects/${project.id}`, {
      method: 'PUT',
      headers: { 'If-Match': String(project.revision) },
      body: JSON.stringify(project),
    }),
  deleteProject: (id: string) => request<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
  fetchLyrics: (input: { url?: string; text?: string; provider?: string; songmid?: string }) =>
    request<LyricsResult>('/api/lyrics', { method: 'POST', body: JSON.stringify(input) }),
  library: (query: { q?: string; tags?: string[]; refresh?: boolean }) => {
    const params = new URLSearchParams()
    if (query.q) params.set('q', query.q)
    if (query.tags?.length) params.set('tags', query.tags.join(','))
    if (query.refresh) params.set('refresh', '1')
    return request<{ entries: LibraryEntry[]; allTags: string[]; stale: boolean }>(`/api/library?${params}`)
  },
  addLibraryEntry: (input: { filename: string; keywords: string[]; text_content: string; link?: string }) =>
    request<LibraryEntry>('/api/library/user', { method: 'POST', body: JSON.stringify(input) }),
  deleteLibraryEntry: (id: string) =>
    request<{ ok: true }>(`/api/library/user/${id}`, { method: 'DELETE' }),
  importXlsx: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch('/api/import/xlsx', { method: 'POST', body: form })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { message?: string } | null
      throw new Error(body?.message ?? `导入失败（${response.status}）`)
    }
    return response.json() as Promise<LyricsResult>
  },
  exportXlsx: async (id: string, options: ExportOptions) => {
    const response = await fetch(`/api/projects/${id}/export/xlsx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })
    if (!response.ok) throw new Error('导出失败')
    return response.blob()
  },
}

/**
 * 保存项目，遇到版本冲突时用服务端最新的 revision 再试一次。
 * 这是本地单用户工具，冲突只可能来自并发保存，不需要覆盖用户刚写的本地内容。
 */
/**
 * 页面要关掉时的兜底保存：keepalive 让请求在文档销毁后仍能发出去。
 * 失败就算了，用户已经离开，没有界面可以报错。
 */
export async function saveProjectKeepalive(project: Project): Promise<void> {
  await fetch(`/api/projects/${project.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': String(project.revision) },
    body: JSON.stringify(project),
    keepalive: true,
  }).catch(() => undefined)
}

export async function saveProjectWithRecovery(project: Project): Promise<Project> {
  try {
    return await api.saveProject(project)
  } catch (error) {
    const latest = await api.getProject(project.id)
    return api.saveProject({ ...project, revision: latest.revision })
  }
}
