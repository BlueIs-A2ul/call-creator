import { describe, expect, it } from 'vitest'
import { mergeLibrary, searchLibrary, toBuiltinEntries } from '@server/library/service'

const raw = [
  { filename: '首推call', keywords: ['分词Call'], text_content: '俺の OOO！' },
  { filename: '首推call', keywords: ['分词Call'], text_content: '俺の OOO！' },
  { filename: '尼泊尔语Mix', keywords: ['Mix'], text_content: 'first' },
  { filename: '尼泊尔语Mix', keywords: ['Mix'], text_content: 'second' },
]

describe('library entries', () => {
  it('重名条目生成不同 id', () => {
    const entries = toBuiltinEntries(raw)
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(4)
  })

  it('同一份数据生成的 id 稳定', () => {
    expect(toBuiltinEntries(raw).map((entry) => entry.id)).toEqual(
      toBuiltinEntries(raw).map((entry) => entry.id),
    )
  })

  it('按名称、标签、正文搜索', () => {
    const entries = toBuiltinEntries(raw)
    expect(searchLibrary(entries, '首推', []).map((entry) => entry.filename)).toContain('首推call')
    expect(searchLibrary(entries, '', ['Mix'])).toHaveLength(2)
    expect(searchLibrary(entries, 'OOO', [])).toHaveLength(2)
  })

  it('用户词条覆盖同 id 的内置词条', () => {
    const builtin = toBuiltinEntries(raw)
    const user = [{ ...builtin[0], origin: 'user' as const, filename: '自定义' }]
    const merged = mergeLibrary(builtin, user, [])
    expect(merged.find((entry) => entry.id === builtin[0].id)?.filename).toBe('自定义')
  })

  it('隐藏的内置词条不出现', () => {
    const builtin = toBuiltinEntries(raw)
    const merged = mergeLibrary(builtin, [], [builtin[0].id])
    expect(merged).toHaveLength(3)
  })
})
