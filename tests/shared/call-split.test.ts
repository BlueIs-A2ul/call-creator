import { describe, expect, it } from 'vitest'
import { assignPhrasesToRows, extractCallPhrases, splitCallForRows } from '@shared/call-split'

const entry = `原文：
俺の OOO！
OOO！ OOO！
超絶可愛い　OOO！
罗马字：
O-Re-No OOO！
OOO！ OOO！
ChouzetsuKawaii OOO！`

describe('extractCallPhrases', () => {
  it('默认只取罗马字那段', () => {
    expect(extractCallPhrases(entry)).toEqual([
      'O-Re-No OOO！',
      'OOO！ OOO！',
      'ChouzetsuKawaii OOO！',
    ])
  })

  it('可以指定取原文那段', () => {
    expect(extractCallPhrases(entry, 'original')[0]).toBe('俺の OOO！')
  })

  it('没有分段标记时整段都当句子', () => {
    expect(extractCallPhrases('A～OOO！\nB～OOO！')).toEqual(['A～OOO！', 'B～OOO！'])
  })

  it('只有原文时退回原文', () => {
    expect(extractCallPhrases('原文：\n俺の OOO！')).toEqual(['俺の OOO！'])
  })

  it('丢掉空行', () => {
    expect(extractCallPhrases('罗马字：\n\n  A  \n\nB\n')).toEqual(['A', 'B'])
  })
})

describe('assignPhrasesToRows', () => {
  it('句数和行数一致时一句一行', () => {
    expect(assignPhrasesToRows(['1', '2', '3'], 3)).toEqual(['1', '2', '3'])
  })

  it('句多行少时尽量均分', () => {
    expect(assignPhrasesToRows(['1', '2', '3', '4', '5', '6'], 4)).toEqual([
      '1\n2',
      '3\n4',
      '5',
      '6',
    ])
  })

  it('句少行多时后面留空', () => {
    expect(assignPhrasesToRows(['1', '2'], 4)).toEqual(['1', '2', '', ''])
  })

  it('没有句子时全空', () => {
    expect(assignPhrasesToRows([], 2)).toEqual(['', ''])
    expect(assignPhrasesToRows(['1'], 0)).toEqual([])
  })
})

describe('splitCallForRows', () => {
  it('三句罗马字分给三行', () => {
    const { phrases, slices } = splitCallForRows(entry, 3)
    expect(phrases).toHaveLength(3)
    expect(slices).toEqual(['O-Re-No OOO！', 'OOO！ OOO！', 'ChouzetsuKawaii OOO！'])
  })
})
