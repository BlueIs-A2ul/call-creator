import type { LyricsResult, ProviderId } from '@shared/types'

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
  }
  if (input.provider) {
    const matched = providers.find((provider) => provider.id === input.provider)
    if (matched) return matched
  }
  throw new Error('没有可用的歌词来源')
}
