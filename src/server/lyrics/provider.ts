import type { LyricsResult, ProviderId } from '@shared/types'
import { ProviderError } from './errors'

export interface LyricsFetchInput {
  url?: URL
  text?: string
  songmid?: string
}

export interface LyricsProvider {
  id: ProviderId
  canHandle(url: URL): boolean
  fetch(input: LyricsFetchInput): Promise<LyricsResult>
}

export function selectProvider(
  providers: LyricsProvider[],
  input: { url?: URL; provider?: ProviderId },
): LyricsProvider {
  if (input.url) {
    const matched = providers.find((provider) => provider.canHandle(input.url!))
    if (matched) return matched
    // 认出了链接但没有任何来源负责它：这是用户输入问题，不该报 500
    throw new ProviderError('INVALID_URL', `不支持的域名：${input.url.hostname}`)
  }
  if (input.provider) {
    const matched = providers.find((provider) => provider.id === input.provider)
    if (matched) return matched
  }
  throw new ProviderError('INVALID_URL', '没有识别出链接')
}
