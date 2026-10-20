import { describe, expect, it } from 'vitest'
import { parseLrc } from '@shared/lrc'

describe('parseLrc', () => {
  it('解析标准时间戳并按时间排序', () => {
    const result = parseLrc('[00:02.50]second\n[00:01.00]first')
    expect(result.lines.map((line) => line.text)).toEqual(['first', 'second'])
    expect(result.lines[0].timeMs).toBe(1000)
  })

  it('接受冒号作为毫秒分隔符', () => {
    const result = parseLrc('[00:22:85]Stay with me')
    expect(result.lines[0].timeMs).toBe(22850)
  })

  it('一行多个时间戳拆成多行', () => {
    const result = parseLrc('[00:01.00][00:03.00]repeat')
    expect(result.lines).toHaveLength(2)
    expect(result.lines.map((line) => line.timeMs)).toEqual([1000, 3000])
  })

  it('元数据不进入歌词行', () => {
    const result = parseLrc('[ti:New World]\n[ar:.LiNIXLiNE.]\n[00:01.00]hello')
    expect(result.title).toBe('New World')
    expect(result.artist).toBe('.LiNIXLiNE.')
    expect(result.lines).toHaveLength(1)
  })

  it('纯文本不加时间戳也不产生警告', () => {
    const result = parseLrc('第一行\n第二行')
    expect(result.lines.map((line) => line.text)).toEqual(['第一行', '第二行'])
    expect(result.warnings).toEqual([])
  })
})
