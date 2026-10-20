import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createNeteaseProvider } from '@server/lyrics/netease'

const detail = JSON.parse(readFileSync('tests/fixtures/netease-detail.json', 'utf8'))
const lyric = JSON.parse(readFileSync('tests/fixtures/netease-lyric.json', 'utf8'))

describe('netease provider', () => {
  it('抓取歌曲信息并兼容冒号毫秒', async () => {
    const getJson = vi.fn(async (url: string) => (url.includes('/lyric') ? lyric : detail))
    const provider = createNeteaseProvider({
      getJson,
      followRedirects: async (url) => url,
    })

    const result = await provider.fetch({
      url: new URL('https://music.163.com/song?id=2733002471'),
    })

    expect(result.title).toBe('New World')
    expect(result.artist).toBe('.LiNIXLiNE.')
    expect(result.lines[2].timeMs).toBe(22850)
  })

  it('没有歌词时抛出 NO_LYRICS', async () => {
    const provider = createNeteaseProvider({
      getJson: async (url) =>
        url.includes('/lyric') ? { lrc: { lyric: '' } } : detail,
      followRedirects: async (url) => url,
    })

    await expect(
      provider.fetch({ url: new URL('https://music.163.com/song?id=1') }),
    ).rejects.toMatchObject({ code: 'NO_LYRICS' })
  })
})
