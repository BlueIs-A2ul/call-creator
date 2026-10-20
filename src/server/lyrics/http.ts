import { isAllowedMusicHost } from '@shared/urls'
import { ProviderError } from './errors'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

export interface ProviderDeps {
  getJson<T>(url: string, referer: string): Promise<T>
  followRedirects(url: URL): Promise<URL>
}

export function assertAllowed(url: URL): void {
  if (url.protocol !== 'https:') throw new ProviderError('INVALID_URL', '只支持 https 链接')
  if (!isAllowedMusicHost(url.hostname)) {
    throw new ProviderError('INVALID_URL', `不支持的域名：${url.hostname}`)
  }
}

export async function getJson<T>(
  url: string,
  referer: string,
  timeoutMs = 10_000,
): Promise<T> {
  const target = new URL(url)
  assertAllowed(target)

  const response = await fetch(target, {
    headers: { Referer: referer, 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new ProviderError('NETWORK', `请求失败（${response.status}）`)
  }

  const body = await response.text()
  try {
    return JSON.parse(body) as T
  } catch {
    throw new ProviderError('PROVIDER_PARSE_ERROR', '平台返回的不是 JSON', body.slice(0, 200))
  }
}

export async function followRedirects(input: URL, maxHops = 3): Promise<URL> {
  let current = input
  for (let hop = 0; hop < maxHops; hop += 1) {
    assertAllowed(current)
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })
    await response.body?.cancel()

    if (response.status < 300 || response.status >= 400) return current

    const location = response.headers.get('location')
    if (!location) return current
    current = new URL(location, current)
  }
  return current
}

export const defaultProviderDeps: ProviderDeps = { getJson, followRedirects }
