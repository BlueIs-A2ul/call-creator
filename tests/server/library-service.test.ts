import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLibraryService, normalizeEntries, toBuiltinEntries } from '@server/library/service'

const raw = [
  { filename: '首推call', keywords: ['分词Call'], text_content: '俺の OOO！' },
  { filename: '尼泊尔语Mix', keywords: ['Mix'], text_content: 'first' },
]

const dirs: string[] = []

async function makeEnv(localEntries?: unknown) {
  const dir = await mkdtemp(join(tmpdir(), 'call-sheet-lib-'))
  dirs.push(dir)
  const localFile = join(dir, 'library.json')
  if (localEntries !== undefined) {
    await writeFile(localFile, JSON.stringify(localEntries), 'utf8')
  }
  return { dir, localFile }
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('library service (本地快照优先)', () => {
  it('默认只读本地文件，不访问网络', async () => {
    const { dir, localFile } = await makeEnv(raw)
    const fetchMock = vi.fn(async () => {
      throw new Error('默认路径不应该联网')
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLibraryService({ dataDir: dir, localFile }).getMerged()

    expect(result.source).toBe('local')
    expect(result.entries).toHaveLength(2)
    expect(result.entries[0].id).toMatch(/^builtin-/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('本地文件是原始格式时自动补 id', async () => {
    const { dir, localFile } = await makeEnv(raw)
    const result = await createLibraryService({ dataDir: dir, localFile }).getMerged()
    expect(result.entries.map((entry) => entry.id)).toEqual(toBuiltinEntries(raw).map((entry) => entry.id))
  })

  it('refresh=1 时拉取远端并写入缓存，之后默认走缓存', async () => {
    const { dir, localFile } = await makeEnv()
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(raw), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const service = createLibraryService({
      dataDir: dir,
      localFile,
      remoteUrl: 'https://example.com/single_skill.json',
    })

    const refreshed = await service.getMerged(true)
    expect(refreshed.source).toBe('remote')
    expect(refreshed.entries).toHaveLength(2)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const cachedFile = join(dir, 'cache', 'library.json')
    expect(JSON.parse(await readFile(cachedFile, 'utf8'))).toHaveLength(2)

    const again = await service.getMerged()
    expect(again.source).toBe('cache')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('刷新失败时回退本地并标记 stale', async () => {
    const { dir, localFile } = await makeEnv(raw)
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down')
    }))

    const result = await createLibraryService({
      dataDir: dir,
      localFile,
      remoteUrl: 'https://example.com/single_skill.json',
    }).getMerged(true)

    expect(result.source).toBe('local')
    expect(result.stale).toBe(true)
    expect(result.entries).toHaveLength(2)
  })

  it('本地没有数据也没有远端配置时给出同步提示', async () => {
    const { dir, localFile } = await makeEnv()
    await expect(createLibraryService({ dataDir: dir, localFile }).getMerged()).rejects.toThrow(
      /library:sync/,
    )
  })
})

describe('normalizeEntries', () => {
  it('对已经归一化的条目是幂等的', () => {
    const normalized = toBuiltinEntries(raw)
    expect(normalizeEntries(normalized)).toEqual(normalized)
  })

  it('拒绝非数组', () => {
    expect(() => normalizeEntries({})).toThrow()
  })
})
