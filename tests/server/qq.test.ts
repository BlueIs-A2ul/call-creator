import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createQqProvider } from '@server/lyrics/qq'

const fixtures = {
  search: JSON.parse(readFileSync('tests/fixtures/qq-search.json', 'utf8')),
  detail: JSON.parse(readFileSync('tests/fixtures/qq-detail.json', 'utf8')),
  detailById: JSON.parse(readFileSync('tests/fixtures/qq-detail-by-id.json', 'utf8')),
  lyric: JSON.parse(readFileSync('tests/fixtures/qq-lyric.json', 'utf8')),
}

function deps() {
  return {
    getJson: vi.fn(async (url: string) => {
      if (url.includes('client_search_cp')) return fixtures.search
      if (url.includes('musicu.fcg')) return fixtures.detail
      return fixtures.lyric
    }),
    followRedirects: async (url: URL) => url,
  }
}

describe('qq provider', () => {
  it('从 songDetail 链接抓取歌词与歌曲信息', async () => {
    const provider = createQqProvider(deps())
    const result = await provider.fetch({
      url: new URL('https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV'),
    })

    expect(result.title).toBe('晴天')
    expect(result.artist).toBe('周杰伦')
    expect(result.lines[0].text).toBe('故事的小黄花')
  })

  it('没有 songmid 时搜索并返回候选', async () => {
    const provider = createQqProvider(deps())
    const result = await provider.fetch({
      url: new URL('https://y.qq.com/'),
      text: '分享 晴天',
    })

    expect(result.candidates).toHaveLength(2)
    expect(result.candidates?.[0].songmid).toBe('0039MnYb0qxYhV')
  })

  it('指定 songmid 时直接抓取', async () => {
    const provider = createQqProvider(deps())
    const result = await provider.fetch({
      url: new URL('https://i.y.qq.com/v8/playsong.html?songmid=0039MnYb0qxYhV'),
    })
    expect(result.lines).toHaveLength(2)
  })

  it('只有数字 songid 的分享链先用详情接口换成 songmid', async () => {
    const requested: string[] = []
    const provider = createQqProvider({
      getJson: vi.fn(async (url: string) => {
        requested.push(url)
        if (url.includes('musicu.fcg')) return fixtures.detailById
        return fixtures.lyric
      }),
      followRedirects: async (url) => url,
    })

    const result = await provider.fetch({
      url: new URL('https://i.y.qq.com/v8/playsong.html?songid=634196637#webchat_redirect'),
    })

    expect(result.title).toBe('Krack')
    expect(result.artist).toBe('KRACK')
    expect(result.lines).toHaveLength(2)
    expect(requested.some((url) => url.includes('song_id'))).toBe(true)
    // 歌词接口应该用解析出来的 songmid，而不是数字 id
    expect(requested.some((url) => url.includes('songmid=0004vH4R3p9Zju'))).toBe(true)
  })
})
