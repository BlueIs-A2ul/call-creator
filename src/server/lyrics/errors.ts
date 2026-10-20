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
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
