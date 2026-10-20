import type { ProviderId } from './types'

const NETEASE_HOSTS = new Set(['music.163.com', 'y.music.163.com', '163cn.tv'])
const QQ_HOSTS = new Set(['y.qq.com', 'i.y.qq.com', 'c6.y.qq.com', 'c.y.qq.com', 'u.y.qq.com'])

export function extractFirstUrl(text: string): URL | null {
  const match = text.match(/https?:\/\/[^\s<>"']+/)
  if (!match) return null
  try {
    return new URL(match[0])
  } catch {
    return null
  }
}

export function detectProvider(url: URL): ProviderId | null {
  if (NETEASE_HOSTS.has(url.hostname)) return 'netease'
  if (QQ_HOSTS.has(url.hostname)) return 'qq'
  return null
}

export function extractNeteaseId(url: URL): string | null {
  const id = url.searchParams.get('id')
  return id && /^\d+$/.test(id) ? id : null
}

export function extractQqSongmid(url: URL): string | null {
  const queryMid = url.searchParams.get('songmid')
  if (queryMid) return queryMid
  const pathMatch = url.pathname.match(/songDetail\/([A-Za-z0-9]+)/)
  return pathMatch?.[1] ?? null
}

export function isAllowedMusicHost(hostname: string): boolean {
  return NETEASE_HOSTS.has(hostname) || QQ_HOSTS.has(hostname)
}
