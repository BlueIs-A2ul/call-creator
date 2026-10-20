import { describe, expect, it } from 'vitest'
import {
  detectProvider,
  extractFirstUrl,
  extractNeteaseId,
  extractQqSongId,
  extractQqSongmid,
  isAllowedMusicHost,
} from '@shared/urls'

describe('urls', () => {
  it('从分享文案里提取第一个链接', () => {
    const url = extractFirstUrl('分享单曲 https://music.163.com/song?id=2733002471&uct2=abc 来自网易云')
    expect(url?.hostname).toBe('music.163.com')
  })

  it('识别网易云', () => {
    expect(detectProvider(new URL('https://music.163.com/song?id=1'))).toBe('netease')
    expect(detectProvider(new URL('https://163cn.tv/abc'))).toBe('netease')
  })

  it('识别 QQ', () => {
    expect(detectProvider(new URL('https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV'))).toBe('qq')
    expect(detectProvider(new URL('https://i2.y.qq.com/n3/other/pages/playsong/index.html?songid=1'))).toBe('qq')
  })

  it('提取网易云 id', () => {
    expect(extractNeteaseId(new URL('https://music.163.com/song?id=2733002471'))).toBe('2733002471')
  })

  it('提取 QQ songmid', () => {
    expect(extractQqSongmid(new URL('https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV'))).toBe('0039MnYb0qxYhV')
    expect(extractQqSongmid(new URL('https://i.y.qq.com/v8/playsong.html?songmid=0039MnYb0qxYhV'))).toBe('0039MnYb0qxYhV')
  })

  it('纯数字 id 不当成 songmid', () => {
    expect(extractQqSongmid(new URL('https://y.qq.com/n/ryqq_v2/songDetail/634196637'))).toBeNull()
  })

  it('提取 QQ 数字 songid', () => {
    expect(
      extractQqSongId(new URL('https://i.y.qq.com/v8/playsong.html?songid=634196637#webchat_redirect')),
    ).toBe('634196637')
    expect(extractQqSongId(new URL('https://y.qq.com/n/ryqq_v2/songDetail/634196637'))).toBe('634196637')
    expect(extractQqSongId(new URL('https://y.qq.com/n/ryqq/songDetail/0039MnYb0qxYhV'))).toBeNull()
  })

  it('分享跳转后的子域也在白名单里', () => {
    expect(isAllowedMusicHost('i2.y.qq.com')).toBe(true)
    expect(isAllowedMusicHost('i.y.qq.com')).toBe(true)
    expect(isAllowedMusicHost('y.qq.com')).toBe(true)
    expect(isAllowedMusicHost('y.music.163.com')).toBe(true)
    expect(isAllowedMusicHost('evil-y.qq.com')).toBe(false)
    expect(isAllowedMusicHost('qq.com.evil.com')).toBe(false)
  })
})
