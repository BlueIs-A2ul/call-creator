import { describe, expect, it } from 'vitest'
import { applySubstitutions, findPlaceholders } from '@shared/substitute'

describe('placeholders', () => {
  it('找出 OOO、XXX 和【】', () => {
    expect(findPlaceholders('俺の OOO！XXX 【水色】')).toEqual(['OOO', 'XXX', '水色'])
  })

  it('默认不替换', () => {
    expect(applySubstitutions('俺の OOO', {}, {})).toBe('俺の OOO')
  })

  it('只替换填过值的 token', () => {
    expect(applySubstitutions('俺の OOO、【水色】', { OOO: '小夏' }, {})).toBe('俺の 小夏、【水色】')
  })

  it('单元格 overrides 优先', () => {
    expect(applySubstitutions('OOO', { OOO: '全局' }, { OOO: '本格' })).toBe('本格')
  })
})
