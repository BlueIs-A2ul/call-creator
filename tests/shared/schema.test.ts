import { describe, expect, it } from 'vitest'
import { lyricsInputSchema, projectSchema } from '@shared/schema'

describe('lyricsInputSchema', () => {
  it('接受只有 url 的输入', () => {
    expect(lyricsInputSchema.parse({ url: 'https://music.163.com/song?id=1' }).url).toContain('music.163.com')
  })

  it('拒绝既没有 url 也没有 text 的输入', () => {
    expect(() => lyricsInputSchema.parse({})).toThrow()
  })
})

describe('projectSchema', () => {
  it('接受最小项目', () => {
    const project = projectSchema.parse({
      schemaVersion: 1,
      id: 'p1',
      title: 'New World',
      artist: '.LiNIXLiNE.',
      rows: [{ id: 'r1', lyric: 'Stay with me' }],
      variables: {},
      revision: 0,
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    })
    expect(project.rows).toHaveLength(1)
  })

  it('拒绝缺少 rows 的项目', () => {
    expect(() => projectSchema.parse({ schemaVersion: 1, id: 'p1' })).toThrow()
  })
})
