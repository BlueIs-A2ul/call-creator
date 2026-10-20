import { parseLrc } from '@shared/lrc'
import { extractNeteaseId } from '@shared/urls'
import type { LyricsResult } from '@shared/types'
import { ProviderError } from './errors'
import { defaultProviderDeps, type ProviderDeps } from './http'
import type { LyricsProvider } from './provider'

interface NeteaseDetail {
  songs?: Array<{
    name: string
    duration?: number
    artists: Array<{ name: string }>
    album?: { name: string }
  }>
}

interface NeteaseLyric {
  lrc?: { lyric?: string }
  nolyric?: boolean
}

const REFERER = 'https://music.163.com/'

export function createNeteaseProvider(deps: ProviderDeps = defaultProviderDeps): LyricsProvider {
  return {
    id: 'netease',
    canHandle(url) {
      return ['music.163.com', 'y.music.163.com', '163cn.tv'].includes(url.hostname)
    },
    async fetch({ url }) {
      if (!url) throw new ProviderError('INVALID_URL', '缺少网易云链接')

      // 分享短链里没有 id，只有短链才需要跟着跳转解析
      const finalUrl = extractNeteaseId(url) ? url : await deps.followRedirects(url)
      const id = extractNeteaseId(finalUrl)
      if (!id) throw new ProviderError('INVALID_URL', '链接里没有歌曲 id')

      const [detail, lyric] = await Promise.all([
        deps.getJson<NeteaseDetail>(
          `https://music.163.com/api/song/detail/?id=${id}&ids=%5B${id}%5D`,
          REFERER,
        ),
        deps.getJson<NeteaseLyric>(
          `https://music.163.com/api/song/lyric?id=${id}&lv=1&kv=1&tv=-1`,
          REFERER,
        ),
      ])

      const song = detail.songs?.[0]
      if (!song) throw new ProviderError('NO_LYRICS', '没有找到这首歌')

      const raw = lyric.lrc?.lyric ?? ''
      if (lyric.nolyric || !raw.trim()) {
        throw new ProviderError('NO_LYRICS', '这首歌没有可用歌词')
      }

      const parsed = parseLrc(raw)
      const result: LyricsResult = {
        provider: 'netease',
        title: song.name,
        artist: song.artists.map((artist) => artist.name).join(' / '),
        album: song.album?.name,
        durationMs: song.duration,
        lines: parsed.lines,
        raw,
        warnings: parsed.warnings,
        sourceUrl: finalUrl.href,
      }
      return result
    },
  }
}

export const neteaseProvider = createNeteaseProvider()
