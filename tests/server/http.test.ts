import { afterEach, describe, expect, it, vi } from 'vitest'
import { getJson } from '@server/lyrics/http'
import { ProviderError } from '@server/lyrics/errors'

const DETAIL_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg?data=%7B%22req_0%22%3A%7B%7D%7D'
const REFERER = 'https://y.qq.com/'

function networkError(code: string) {
  return Object.assign(new TypeError('fetch failed'), { cause: { code, message: code } })
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function capture(promise: Promise<unknown>): Promise<ProviderError> {
  try {
    await promise
  } catch (error) {
    expect(error).toBeInstanceOf(ProviderError)
    return error as ProviderError
  }
  throw new Error('预期抛出 ProviderError，但请求成功了')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getJson 的网络错误', () => {
  it('连接被重置时翻译成中文并重试一次', async () => {
    const fetchMock = vi.fn(async () => {
      throw networkError('ECONNRESET')
    })
    vi.stubGlobal('fetch', fetchMock)

    const error = await capture(getJson(DETAIL_URL, REFERER))

    expect(error.code).toBe('NETWORK')
    expect(error.message).toBe('u.y.qq.com 重置了连接')
    expect(error.detail).toContain('ECONNRESET')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('重试成功后正常返回', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError('ECONNRESET'))
      .mockResolvedValueOnce(jsonResponse({ req_0: { code: 0 } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getJson(DETAIL_URL, REFERER)).resolves.toEqual({ req_0: { code: 0 } })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('DNS 解析失败给出可读提示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw networkError('ENOTFOUND')
      }),
    )

    const error = await capture(getJson(DETAIL_URL, REFERER))
    expect(error.message).toBe('无法解析域名 u.y.qq.com，请检查网络或 DNS')
  })

  it('超时不重试，避免让用户等两倍时间', async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    })
    vi.stubGlobal('fetch', fetchMock)

    const error = await capture(getJson(DETAIL_URL, REFERER, 10_000))

    expect(error.code).toBe('NETWORK')
    expect(error.message).toBe('u.y.qq.com 响应超时（超过 10 秒）')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('5xx 重试一次，最终报平台错误', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)

    const error = await capture(getJson(DETAIL_URL, REFERER))

    expect(error.code).toBe('NETWORK')
    expect(error.message).toBe('u.y.qq.com 返回 500')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('4xx 不重试', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, 404))
    vi.stubGlobal('fetch', fetchMock)

    const error = await capture(getJson(DETAIL_URL, REFERER))
    expect(error.message).toBe('u.y.qq.com 返回 404')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('读到一半连接断了也能翻译', async () => {
    const fetchMock = vi.fn(async () => {
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"req_0":'))
          setTimeout(() => controller.error(networkError('ECONNRESET')), 10)
        },
      })
      return new Response(body, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const error = await capture(getJson(DETAIL_URL, REFERER))
    expect(error.code).toBe('NETWORK')
    expect(error.message).toContain('读取响应时中断')
    expect(error.detail).toContain('ECONNRESET')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('非 JSON 返回报解析错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('MusicJsonCallback({})')))

    const error = await capture(getJson(DETAIL_URL, REFERER))
    expect(error.code).toBe('PROVIDER_PARSE_ERROR')
    expect(error.detail).toContain('MusicJsonCallback')
  })

  it('域名不在白名单时直接拒绝，不发请求', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const error = await capture(getJson('https://evil.example.com/api', REFERER))
    expect(error.code).toBe('INVALID_URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
