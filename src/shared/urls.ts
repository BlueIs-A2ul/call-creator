import type { ProviderId } from './types'

const NETEASE_HOSTS = new Set(['music.163.com', 'y.music.163.com', '163cn.tv'])
const QQ_HOSTS = new Set(['y.qq.com', 'i.y.qq.com', 'c6.y.qq.com', 'c.y.qq.com', 'u.y.qq.com'])

// i.y.qq.com 的分享链接会 302 到 i2.y.qq.com 之类的子域，网易云也有 y.music.163.com，
// 所以白名单除了精确域名还要接受这些平台下的任意子域。
const NETEASE_SUFFIX = '.music.163.com'
const QQ_SUFFIX = '.y.qq.com'

export function extractFirstUrl(text: string): URL | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/)
  if (!match) return null
  try {
    return new URL(match[0])
  } catch {
    return null
  }
}

export function isNeteaseHost(hostname: string): boolean {
  return NETEASE_HOSTS.has(hostname) || hostname.endsWith(NETEASE_SUFFIX)
}

export function isQqHost(hostname: string): boolean {
  return QQ_HOSTS.has(hostname) || hostname.endsWith(QQ_SUFFIX)
}

export function detectProvider(url: URL): ProviderId | null {
  if (isNeteaseHost(url.hostname)) return 'netease'
  if (isQqHost(url.hostname)) return 'qq'
  return null
}

export function extractNeteaseId(url: URL): string | null {
  const id = url.searchParams.get('id')
  return id && /^\d+$/.test(id) ? id : null
}

/**
 * QQ 音乐有两套 id：14 位左右的字符串 songmid 和纯数字 songid。
 * 这里只返回 songmid，纯数字的交给 extractQqSongId，避免把 songid 当成 songmid 去请求。
 */
export function extractQqSongmid(url: URL): string | null {
  const queryMid = url.searchParams.get('songmid')
  if (queryMid && !/^\d+$/.test(queryMid)) return queryMid
  const segment = url.pathname.match(/songDetail\/([^/]+)/)?.[1]
  if (segment && /^[A-Za-z0-9]+$/.test(segment) && !/^\d+$/.test(segment)) return segment
  return null
}

export function extractQqSongId(url: URL): string | null {
  const query = url.searchParams.get('songid') ?? url.searchParams.get('song_id')
  if (query && /^\d+$/.test(query)) return query
  const segment = url.pathname.match(/songDetail\/([^/]+)/)?.[1]
  if (segment && /^\d+$/.test(segment)) return segment
  return null
}

export function isAllowedMusicHost(hostname: string): boolean {
  return isNeteaseHost(hostname) || isQqHost(hostname)
}
