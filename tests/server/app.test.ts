import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '@server/app'
import type { LyricsProvider } from '@server/lyrics/provider'

const dirs: string[] = []

const pasteProvider: LyricsProvider = {
  id: 'paste',
  canHandle: () => false,
  async fetch() {
    return {
      provider: 'paste',
      title: 'Pasted Song',
      artist: 'Someone',
      lines: [{ text: 'line one' }, { text: 'line two' }],
      raw: 'line one\nline two',
      warnings: [],
    }
  },
}

async function makeApp() {
  const dir = await mkdtemp(join(tmpdir(), 'call-sheet-api-'))
  dirs.push(dir)
  return buildApp({ dataDir: dir, providers: [pasteProvider], serveStatic: false })
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('api', () => {
  it('创建并读取项目', async () => {
    const app = await makeApp()
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: {
        title: 'New World',
        artist: '.LiNIXLiNE.',
        rows: [{ id: 'r1', lyric: 'hello' }],
      },
    })
    expect(created.statusCode).toBe(200)
    const project = created.json()
    const loaded = await app.inject({ method: 'GET', url: `/api/projects/${project.id}` })
    expect(loaded.json().title).toBe('New World')
  })

  it('粘贴歌词返回统一结构', async () => {
    const app = await makeApp()
    const response = await app.inject({
      method: 'POST',
      url: '/api/lyrics',
      payload: { text: 'line one\nline two', provider: 'paste' },
    })
    expect(response.statusCode).toBe(200)
    expect(response.json().lines).toHaveLength(2)
  })

  it('保存时版本冲突返回 409', async () => {
    const app = await makeApp()
    const created = (
      await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: { title: 'A', artist: 'B', rows: [] },
      })
    ).json()

    const response = await app.inject({
      method: 'PUT',
      url: `/api/projects/${created.id}`,
      headers: { 'if-match': '99' },
      payload: { ...created, title: 'A2' },
    })
    expect(response.statusCode).toBe(409)
  })
})
