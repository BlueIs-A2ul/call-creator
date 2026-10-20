// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectList } from '@web/components/ProjectList'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('[]', { status: 200 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProjectList 间奏时间说明', () => {
  it('首页显示间奏开始时间不准的技术原因', () => {
    render(<ProjectList />)
    expect(screen.getByText('关于间奏时间')).toBeInTheDocument()
    expect(screen.getByText(/只有每句的句首时间戳/)).toBeInTheDocument()
    expect(screen.getByText(/终点取下一句歌词的起始时间/)).toBeInTheDocument()
  })
})
