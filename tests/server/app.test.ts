import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApp } from '@server/app'
import { ProviderError } from '@server/lyrics/errors'
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

async function makeApp(providers: LyricsProvider[] = [pasteProvider]) {
  const dir = await mkdtemp(join(tmpdir(), 'call-sheet-api-'))
  dirs.push(dir)
  return buildApp({ dataDir: dir, providers, serveStatic: false })
}

function throwingProvider(error: Error): LyricsProvider {
  return {
    id: 'qq',
    canHandle: () => true,
    async fetch() {
      throw error
    },
  }
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

  it('平台网络失败返回 502 和可读原因', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const app = await makeApp([
      throwingProvider(new ProviderError('NETWORK', 'u.y.qq.com 重置了连接', 'TypeError | ECONNRESET')),
    ])

    const response = await app.inject({
      method: 'POST',
      url: '/api/lyrics',
      payload: { url: 'https://i.y.qq.com/v8/playsong.html?songid=634196637' },
    })

    expect(response.statusCode).toBe(502)
    expect(response.json()).toMatchObject({ code: 'NETWORK', message: 'u.y.qq.com 重置了连接' })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('u.y.qq.com 重置了连接'))
    warn.mockRestore()
  })

  it('未处理异常返回 500 时带上真实原因', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = await makeApp([throwingProvider(new Error('boom'))])

    const response = await app.inject({
      method: 'POST',
      url: '/api/lyrics',
      payload: { url: 'https://i.y.qq.com/v8/playsong.html?songid=634196637' },
    })

    expect(response.statusCode).toBe(500)
    expect(response.json().message).toContain('boom')
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('不支持的域名返回 400，而不是 500', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dir = await mkdtemp(join(tmpdir(), 'call-sheet-api-'))
    dirs.push(dir)
    const app = await buildApp({ dataDir: dir, serveStatic: false })

    const response = await app.inject({
      method: 'POST',
      url: '/api/lyrics',
      payload: { url: 'https://example.com/song/1' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ code: 'INVALID_URL', message: '不支持的域名：example.com' })
    warn.mockRestore()
  })
})
