import { parseLrc } from '@shared/lrc'
import { extractFirstUrl, extractQqSongId, extractQqSongmid, isQqHost } from '@shared/urls'
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
        mid?: string
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

interface TrackInfo {
  songmid: string
  title: string
  artist: string
  album?: string
  durationMs?: number
}

const REFERER = 'https://y.qq.com/'

function safeCodePoint(code: number): string {
  if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) return ''
  return String.fromCodePoint(code)
}

function decodeEntities(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code: string) => safeCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => safeCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
}

/** 同一个接口既能用 songmid 也能用数字 songid 查歌曲信息。 */
async function fetchTrack(
  deps: ProviderDeps,
  id: { songmid?: string; songId?: string },
): Promise<TrackInfo | null> {
  const param = id.songmid ? { song_mid: id.songmid } : { song_id: Number(id.songId) }
  const payload = JSON.stringify({
    req_0: {
      module: 'music.pf_song_detail_svr',
      method: 'get_song_detail',
      param,
    },
  })
  const url = `https://u.y.qq.com/cgi-bin/musicu.fcg?data=${encodeURIComponent(payload)}`
  const detail = await deps.getJson<QqDetailResponse>(url, REFERER)
  const track = detail.req_0?.data?.track_info
  if (!track) return null

  return {
    songmid: track.mid ?? id.songmid ?? '',
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
      return isQqHost(url.hostname)
    },
    async fetch({ url, text, songmid }) {
      let finalUrl = url ?? null
      let mid = songmid ?? (url ? extractQqSongmid(url) : null)
      let songId = songmid ? null : url ? extractQqSongId(url) : null
      let track: TrackInfo | null = null

      // 链接里已经有 songmid 时不需要再多请求一次站点首页；只有短链/纯数字 id 才需要跟着跳转
      if (!mid && url) {
        finalUrl = await deps.followRedirects(url)
        mid = extractQqSongmid(finalUrl)
        songId = songId ?? extractQqSongId(finalUrl)
      }

      if (!mid && !songId) {
        const textUrl = extractFirstUrl(text ?? '')
        if (textUrl) {
          const resolved = await deps.followRedirects(textUrl)
          mid = extractQqSongmid(resolved)
          songId = extractQqSongId(resolved)
        }
      }

      // i.y.qq.com 这类分享链只有数字 songid，用详情接口换成 songmid
      if (!mid && songId) {
        track = await fetchTrack(deps, { songId })
        mid = track?.songmid || null
        if (!mid) throw new ProviderError('NO_LYRICS', '没有找到这首歌')
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

      const [info, lyric] = await Promise.all([
        track ? Promise.resolve(track) : fetchTrack(deps, { songmid: mid }),
        fetchLyric(deps, mid),
      ])
      const raw = decodeEntities(lyric.lyric ?? '')
      if (!raw.trim()) throw new ProviderError('NO_LYRICS', '这首歌没有可用歌词')

      const parsed = parseLrc(raw)
      return {
        provider: 'qq',
        title: info?.title ?? '',
        artist: info?.artist ?? '',
        album: info?.album,
        durationMs: info?.durationMs,
        lines: parsed.lines,
        raw,
        warnings: parsed.warnings,
        sourceUrl: finalUrl?.href,
      }
    },
  }
}

export const qqProvider = createQqProvider()
