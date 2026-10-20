import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@shared/types'
import { saveProjectWithRecovery } from '@web/api'

const project: Project = {
  schemaVersion: 1,
  id: 'p1',
  title: 'New World',
  artist: '.LiNIXLiNE.',
  rows: [{ id: 'r1', lyric: 'hello' }],
  variables: {},
  revision: 1,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('saveProjectWithRecovery', () => {
  it('版本冲突时拉取最新 revision 再保存一次', async () => {
    const sentRevisions: number[] = []
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body)) as Project
        sentRevisions.push(body.revision)
        if (sentRevisions.length === 1) {
          return new Response(JSON.stringify({ code: 'REVISION_CONFLICT', message: '项目已被其他窗口修改' }), {
            status: 409,
          })
        }
        return new Response(JSON.stringify({ ...body, revision: 8 }), { status: 200 })
      }
      return new Response(JSON.stringify({ ...project, revision: 7 }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const saved = await saveProjectWithRecovery(project)

    expect(sentRevisions).toEqual([1, 7])
    expect(saved.revision).toBe(8)
  })

  it('没有冲突时只发一次请求', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Project
      return new Response(JSON.stringify({ ...body, revision: 2 }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const saved = await saveProjectWithRecovery(project)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(saved.revision).toBe(2)
  })
})
