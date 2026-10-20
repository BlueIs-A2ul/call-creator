import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@web/api'
import type { Project } from '@shared/types'

const project: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 't',
  artist: 'a',
  rows: [{ id: 'r1', lyric: 'hello' }],
  variables: {},
  revision: 0,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
}

function stubFetch() {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    }),
  )
  return calls
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const headers = (init?.headers ?? {}) as Record<string, string>
  return headers[name]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('web api 请求头', () => {
  it('删除项目：无 body 的 DELETE 不带 JSON Content-Type', async () => {
    const calls = stubFetch()
    await api.deleteProject('p1')
    expect(calls[0].url).toBe('/api/projects/p1')
    expect(calls[0].init?.method).toBe('DELETE')
    expect(calls[0].init?.body).toBeUndefined()
    expect(headerOf(calls[0].init, 'Content-Type')).toBeUndefined()
  })

  it('GET 请求不带 JSON Content-Type', async () => {
    const calls = stubFetch()
    await api.listProjects()
    expect(calls[0].init?.method).toBeUndefined()
    expect(headerOf(calls[0].init, 'Content-Type')).toBeUndefined()
  })

  it('带 body 的 PUT 保留 JSON Content-Type', async () => {
    const calls = stubFetch()
    await api.saveProject(project)
    expect(calls[0].init?.method).toBe('PUT')
    expect(headerOf(calls[0].init, 'Content-Type')).toBe('application/json')
  })

  it('带 body 的 POST 保留 JSON Content-Type', async () => {
    const calls = stubFetch()
    await api.fetchLyrics({ text: 'line', provider: 'paste' })
    expect(calls[0].init?.method).toBe('POST')
    expect(headerOf(calls[0].init, 'Content-Type')).toBe('application/json')
  })
})
