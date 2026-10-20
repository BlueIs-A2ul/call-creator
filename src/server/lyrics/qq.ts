import { parseLrc } from '@shared/lrc'
import { extractFirstUrl, extractQqSongmid } from '@shared/urls'
import type { LyricsResult, SongCandidate } from '@shared/types'
import { ProviderError } from './errors'
import { defaultProviderDeps, type ProviderDeps } from './http'
import type { LyricsProvider } from './provider'

interface QqSearchResponse {
  data?: {
    song?: {
      list?: Array<{
        songmid: string
        songname: string
        singer: Array<{ name: string }>
        interval?: number
      }>
    }
  }
}

interface QqDetailResponse {
  req_0?: {
    code: number
    data?: {
      track_info?: {
        name: string
        interval?: number
        singer: Array<{ name: string }>
        album?: { name: string }
      }
    }
  }
}

interface QqLyricResponse {
  retcode?: number
  lyric?: string
}

const REFERER = 'https://y.qq.com/'

function decodeEntities(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

async function fetchDetail(
  deps: ProviderDeps,
  songmid: string,
): Promise<{ title: string; artist: string; album?: string; durationMs?: number }> {
  const payload = JSON.stringify({
    req_0: {
      module: 'music.pf_song_detail_svr',
      method: 'get_song_detail',
      param: { song_mid: songmid },
    },
  })
  const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(payload)}`
  const detail = await deps.getJson<QqDetailResponse>(url, REFERER)
  const track = detail.req_0?.data?.track_info
  if (!track) return { title: '', artist: '' }
  return {
    title: track.name,
    artist: track.singer.map((singer) => singer.name).join(' / '),
    album: track.album?.name,
    durationMs: track.interval ? track.interval * 1000 : undefined,
  }
}

async function fetchLyric(deps: ProviderDeps, songmid: string): Promise<QqLyricResponse> {
  const url = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&format=json&nobase64=1&g_tk=5381`
  return deps.getJson<QqLyricResponse>(url, REFERER)
}

export function createQqProvider(deps: ProviderDeps = defaultProviderDeps): LyricsProvider {
  return {
    id: 'qq',
    canHandle(url) {
      return ['y.qq.com', 'i.y.qq.com', 'c6.y.qq.com', 'c.y.qq.com', 'u.y.qq.com'].includes(url.hostname)
    },
    async fetch({ url, text, songmid }) {
      const finalUrl = url ? await deps.followRedirects(url) : null
      let mid = songmid ?? (finalUrl ? extractQqSongmid(finalUrl) : null)

      if (!mid) {
        const fromText = text ?? finalUrl?.href ?? ''
        const textUrl = extractFirstUrl(fromText)
        if (textUrl) {
          const resolved = await deps.followRedirects(textUrl)
          mid = extractQqSongmid(resolved)
        }
      }

      if (!mid) {
        const keyword = (text ?? finalUrl?.href ?? '')
          .replace(/https?:\/\/\S+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        if (!keyword) throw new ProviderError('INVALID_URL', '没有识别出歌曲或搜索关键词')

        const searchUrl = `https://c.y.qq.com/soso/fcgi-bin/client_search_cp?w=${encodeURIComponent(keyword)}&format=json&n=8&p=1`
        const search = await deps.getJson<QqSearchResponse>(searchUrl, REFERER)
        const list = search.data?.song?.list ?? []
        if (list.length === 0) throw new ProviderError('NO_LYRICS', '没有搜到这首歌')

        if (list.length > 1) {
          const candidates: SongCandidate[] = list.map((song) => ({
            songmid: song.songmid,
            title: song.songname,
            artist: song.singer.map((singer) => singer.name).join(' / '),
          }))
          const result: LyricsResult = {
            provider: 'qq',
            title: '',
            artist: '',
            lines: [],
            raw: '',
            warnings: [],
            candidates,
          }
          return result
        }
        mid = list[0].songmid
      }

      const [detail, lyric] = await Promise.all([fetchDetail(deps, mid), fetchLyric(deps, mid)])
      const raw = decodeEntities(lyric.lyric ?? '')
      if (!raw.trim()) throw new ProviderError('NO_LYRICS', '这首歌没有可用歌词')

      const parsed = parseLrc(raw)
      return {
        provider: 'qq',
        title: detail.title,
        artist: detail.artist,
        album: detail.album,
        durationMs: detail.durationMs,
        lines: parsed.lines,
        raw,
        warnings: parsed.warnings,
        sourceUrl: finalUrl?.href,
      }
    },
  }
}

export const qqProvider = createQqProvider()
