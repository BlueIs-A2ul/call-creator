import { isAllowedMusicHost } from '@shared/urls'
import { ProviderError } from './errors'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'

const DEFAULT_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 2
const RETRY_DELAY_MS = 300

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

interface FetchFailure {
  message: string
  detail: string
  retryable: boolean
}

/** 把 undici/Node 的连接层异常翻译成用户能看懂的话，而不是让 fetch 的原始错误冒成 500。 */
function describeFetchFailure(error: unknown, target: URL, timeoutMs: number): FetchFailure {
  const err = error as Error & { name?: string; cause?: { code?: string; errno?: string; message?: string } }
  const name = err?.name ?? ''
  const causeCode = err?.cause?.code ?? err?.cause?.errno ?? ''
  const causeMessage = err?.cause?.message ?? ''
  const detail = [name, causeCode, causeMessage, err?.message].filter(Boolean).join(' | ')
  const host = target.hostname

  if (name === 'TimeoutError' || name === 'AbortError') {
    // 超时不再重试，否则用户要等两倍时间才看到错误
    return { message: `${host} 响应超时（超过 ${Math.round(timeoutMs / 1000)} 秒）`, detail, retryable: false }
  }

  const byCode: Record<string, string> = {
    ENOTFOUND: `无法解析域名 ${host}，请检查网络或 DNS`,
    EAI_AGAIN: `DNS 查询超时：${host}`,
    ECONNREFUSED: `连接被拒绝：${host}`,
    ECONNRESET: `${host} 重置了连接`,
    ETIMEDOUT: `连接 ${host} 超时`,
    EPIPE: `与 ${host} 的连接被中断`,
    UND_ERR_CONNECT_TIMEOUT: `连接 ${host} 超时`,
    UND_ERR_SOCKET: `与 ${host} 的连接中断`,
    UND_ERR_CLOSED: `与 ${host} 的连接已关闭`,
    CERT_HAS_EXPIRED: `TLS 证书已过期：${host}`,
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: `TLS 证书验证失败：${host}`,
    DEPTH_ZERO_SELF_SIGNED_CERT: `TLS 证书不受信任：${host}`,
    ERR_TLS_CERT_ALTNAME_INVALID: `TLS 证书与域名不匹配：${host}`,
  }

  return { message: byCode[causeCode] ?? `访问 ${host} 失败`, detail, retryable: true }
}

async function readJson<T>(target: URL, referer: string, timeoutMs: number): Promise<T> {
  let response: Response
  try {
    response = await fetch(target, {
      headers: { Referer: referer, 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const failure = describeFetchFailure(error, target, timeoutMs)
    throw new ProviderError('NETWORK', failure.message, failure.detail, failure.retryable)
  }

  if (!response.ok) {
    // 5xx 是平台自己抽风，值得重试一次；4xx 是我们请求的问题，重试没意义
    throw new ProviderError(
      'NETWORK',
      `${target.hostname} 返回 ${response.status}`,
      `GET ${target.pathname} → ${response.status} ${response.statusText}`,
      response.status >= 500,
    )
  }

  let body: string
  try {
    body = await response.text()
  } catch (error) {
    const failure = describeFetchFailure(error, target, timeoutMs)
    throw new ProviderError('NETWORK', `${target.hostname} 读取响应时中断`, failure.detail, true)
  }

  try {
    return JSON.parse(body) as T
  } catch {
    throw new ProviderError('PROVIDER_PARSE_ERROR', '平台返回的不是 JSON', body.slice(0, 200))
  }
}

export async function getJson<T>(
  url: string,
  referer: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const target = new URL(url)
  assertAllowed(target)

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await readJson<T>(target, referer, timeoutMs)
    } catch (error) {
      const canRetry = error instanceof ProviderError && error.retryable && attempt < MAX_ATTEMPTS
      if (!canRetry) throw error
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }
  }
}

export async function followRedirects(input: URL, maxHops = 3): Promise<URL> {
  let current = input
  for (let hop = 0; hop < maxHops; hop += 1) {
    assertAllowed(current)
    let response: Response
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // 短链域名不可达时保留原链接，交给 Provider 判断是否还能继续
      return current
    }
    await response.body?.cancel()

    if (response.status < 300 || response.status >= 400) return current

    const location = response.headers.get('location')
    if (!location) return current
    current = new URL(location, current)
  }
  return current
}

export const defaultProviderDeps: ProviderDeps = { getJson, followRedirects }
