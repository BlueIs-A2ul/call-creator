import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createProjectStore } from '@server/projects/store'
import type { Project } from '@shared/types'

const dirs: string[] = []

async function makeStore() {
  const dir = await mkdtemp(join(tmpdir(), 'call-sheet-'))
  dirs.push(dir)
  return createProjectStore(dir)
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('project store', () => {
  it('创建、读取、列出项目', async () => {
    const store = await makeStore()
    const created = await store.create({
      title: 'New World',
      artist: '.LiNIXLiNE.',
      rows: [{ id: 'r1', lyric: 'Stay with me' }],
    })

    expect(created.revision).toBe(0)
    expect((await store.get(created.id)).title).toBe('New World')
    expect(await store.list()).toHaveLength(1)
  })

  it('版本号不匹配时拒绝保存', async () => {
    const store = await makeStore()
    const created = await store.create({ title: 'A', artist: 'B', rows: [] })

    const next: Project = { ...created, title: 'A2', revision: 1 }
    await expect(store.save(created.id, next, 99)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' })
  })

  it('保存成功后 revision 自增', async () => {
    const store = await makeStore()
    const created = await store.create({ title: 'A', artist: 'B', rows: [] })
    const saved = await store.save(created.id, { ...created, title: 'A2' }, 0)
    expect(saved.revision).toBe(1)
    expect(saved.title).toBe('A2')
  })
})
