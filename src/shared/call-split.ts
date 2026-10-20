export type CallSection = 'romaji' | 'original'

const SECTION_HEADERS: Array<{ key: CallSection; pattern: RegExp }> = [
  { key: 'original', pattern: /^(原文|原词|歌词|日语|日本語)\s*[:：]?$/ },
  { key: 'romaji', pattern: /^(罗马字?音?|罗马拼音|罗马字读音|romaji|读音)\s*[:：]?$/i },
]

/**
 * 词库里的词条大多是「原文：…」+「罗马字：…」两块。
 * 切片默认只取罗马字那一块（排练时喊的就是它），没有分段标记时整段都当作句子。
 */
export function extractCallPhrases(text: string, section: CallSection = 'romaji'): string[] {
  const sections: Record<CallSection, string[]> = { original: [], romaji: [] }
  const loose: string[] = []
  let current: CallSection | null = null

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const header = SECTION_HEADERS.find((item) => item.pattern.test(line))
    if (header) {
      current = header.key
      continue
    }
    if (current) sections[current].push(line)
    else loose.push(line)
  }

  const picked = sections[section]
  if (picked.length > 0) return picked
  const other = sections[section === 'romaji' ? 'original' : 'romaji']
  if (other.length > 0) return other
  return loose
}

/**
 * 把 N 句词分配到 M 行歌词上：
 * - 一样多 → 一句一行
 * - 词多行少 → 尽量均分（6 句 4 行 → 2/2/1/1），多句在同一个单元格里换行
 * - 词少行多 → 前几行一句一个，剩下的行留空，留给用户手填
 */
export function assignPhrasesToRows(phrases: string[], rowCount: number): string[] {
  if (rowCount <= 0) return []
  if (phrases.length === 0) return Array.from({ length: rowCount }, () => '')

  if (phrases.length <= rowCount) {
    const slices = phrases.map((phrase) => phrase.trim())
    while (slices.length < rowCount) slices.push('')
    return slices
  }

  const base = Math.floor(phrases.length / rowCount)
  const extra = phrases.length % rowCount
  const slices: string[] = []
  let cursor = 0
  for (let index = 0; index < rowCount; index += 1) {
    const size = base + (index < extra ? 1 : 0)
    slices.push(phrases.slice(cursor, cursor + size).join('\n'))
    cursor += size
  }
  return slices
}

export function splitCallForRows(
  text: string,
  rowCount: number,
  section: CallSection = 'romaji',
): { phrases: string[]; slices: string[] } {
  const phrases = extractCallPhrases(text, section)
  return { phrases, slices: assignPhrasesToRows(phrases, rowCount) }
}
