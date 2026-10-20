const TOKEN_RE = /OOO|XXX|【([^】]+)】/g

export function findPlaceholders(text: string): string[] {
  const tokens = new Set<string>()
  for (const match of text.matchAll(TOKEN_RE)) {
    tokens.add(match[1] ?? match[0])
  }
  return [...tokens]
}

export function applySubstitutions(
  text: string,
  variables: Record<string, string>,
  overrides: Record<string, string> = {},
): string {
  return text.replace(TOKEN_RE, (whole, bracketKey: string | undefined) => {
    const key = bracketKey ?? whole
    return overrides[key] ?? variables[key] ?? whole
  })
}
