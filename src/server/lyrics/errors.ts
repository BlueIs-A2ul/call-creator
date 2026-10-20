export type ProviderErrorCode =
  | 'INVALID_URL'
  | 'NETWORK'
  | 'NO_LYRICS'
  | 'PROVIDER_PARSE_ERROR'
  | 'AMBIGUOUS_SONG'

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly detail?: string,
    /** 网络层抖动，值得原样重试一次 */
    public readonly retryable = false,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
