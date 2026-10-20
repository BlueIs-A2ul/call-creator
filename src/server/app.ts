import Fastify, { type FastifyInstance } from 'fastify'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { nanoid } from 'nanoid'
import { exportOptionsSchema, libraryInputSchema, lyricsInputSchema, projectSchema } from '@shared/schema'
import { extractFirstUrl } from '@shared/urls'
import { parseLrc } from '@shared/lrc'
import type { LyricsResult, ProviderId } from '@shared/types'
import { createLibraryService, DEFAULT_LIBRARY_URL, searchLibrary } from './library/service'
import { createProjectStore, StoreError } from './projects/store'
import { writeXlsx, asExcelBuffer } from './export/xlsx'
import { ProviderError } from './lyrics/errors'
import { neteaseProvider } from './lyrics/netease'
import { qqProvider } from './lyrics/qq'
import { selectProvider, type LyricsProvider } from './lyrics/provider'

export interface AppOptions {
  dataDir: string
  providers?: LyricsProvider[]
  serveStatic?: boolean
  libraryUrl?: string
  libraryFile?: string
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

  const providers = options.providers ?? [neteaseProvider, qqProvider]
  const store = createProjectStore(options.dataDir)
  const library = createLibraryService({
    dataDir: options.dataDir,
    localFile: options.libraryFile,
    remoteUrl: options.libraryUrl ?? DEFAULT_LIBRARY_URL,
  })

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ProviderError) {
      const status = error.code === 'INVALID_URL' ? 400 : error.code === 'NO_LYRICS' ? 422 : 502
      return reply.status(status).send({ code: error.code, message: error.message, detail: error.detail })
    }
    if (error instanceof StoreError) {
      return reply.status(error.code === 'NOT_FOUND' ? 404 : 409).send({ code: error.code, message: error.message })
    }
    const name = (error as { name?: string }).name
    const message = error instanceof Error ? error.message : String(error)
    if (name === 'ZodError') {
      return reply.status(400).send({ code: 'VALIDATION', message: '请求参数不合法', detail: message })
    }
    return reply.status(500).send({ code: 'INTERNAL', message: '服务器内部错误', detail: message })
  })

  app.get('/api/health', async () => ({ ok: true }))

  app.post('/api/lyrics', async (request) => {
    const input = lyricsInputSchema.parse(request.body)
    const rawUrl = input.url ?? input.text
    const url = rawUrl ? extractFirstUrl(rawUrl) : null

    if (input.provider === 'paste' || (!url && !input.provider)) {
      const raw = input.text ?? input.url ?? ''
      const parsed = parseLrc(raw)
      return {
        provider: 'paste',
        title: '',
        artist: '',
        lines: parsed.lines,
        raw,
        warnings: parsed.warnings,
      } satisfies LyricsResult
    }

    const provider = selectProvider(providers, { url: url ?? undefined, provider: input.provider as ProviderId | undefined })
    if (!url && provider.id !== 'qq') throw new ProviderError('INVALID_URL', '没有识别出链接')
    return provider.fetch({ url: url ?? undefined, text: input.text, songmid: input.songmid })
  })

  app.post('/api/import/xlsx', async (request, reply) => {
    const file = await request.file()
    if (!file) return reply.status(400).send({ code: 'NO_FILE', message: '没有上传文件' })
    const ExcelJS = (await import('exceljs')).default
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(asExcelBuffer(await file.toBuffer()))
    const sheet = workbook.worksheets[0]
    const lines: string[] = []
    sheet?.eachRow((row) => {
      const value = row.getCell(1).text.trim()
      if (value) lines.push(value)
    })
    return {
      provider: 'xlsx',
      title: '',
      artist: '',
      lines: lines.map((text) => ({ text })),
      raw: lines.join('\n'),
      warnings: [],
    } satisfies LyricsResult
  })

  app.get('/api/library', async (request) => {
    const query = request.query as { q?: string; tags?: string; refresh?: string }
    const result = await library.getMerged(query.refresh === '1')
    const tags = query.tags ? query.tags.split(',').filter(Boolean) : []
    return {
      entries: searchLibrary(result.entries, query.q ?? '', tags),
      meta: result.meta,
      source: result.source,
      stale: result.stale,
      allTags: [...new Set(result.entries.flatMap((entry) => entry.keywords))].sort(),
    }
  })

  app.post('/api/library/user', async (request) => {
    const input = libraryInputSchema.parse(request.body)
    return library.addUser(input)
  })

  app.put('/api/library/user/:id', async (request) => {
    const { id } = request.params as { id: string }
    return library.updateUser(id, request.body as Partial<import('@shared/types').LibraryEntry>)
  })

  app.delete('/api/library/user/:id', async (request) => {
    const { id } = request.params as { id: string }
    await library.removeUser(id)
    return { ok: true }
  })

  app.put('/api/library/hidden', async (request) => {
    const { id, hidden } = request.body as { id: string; hidden: boolean }
    await library.setHidden(id, hidden)
    return { ok: true }
  })

  app.get('/api/projects', async () => store.list())

  app.post('/api/projects', async (request) => {
    const body = request.body as {
      title?: string
      artist?: string
      album?: string
      durationMs?: number
      source?: { provider: ProviderId; url?: string; fetchedAt: string }
      rows?: Array<{ id?: string; lyric: string; timeMs?: number }>
      variables?: Record<string, string>
    }
    return store.create({
      title: body.title ?? '未命名',
      artist: body.artist ?? '',
      album: body.album,
      durationMs: body.durationMs,
      source: body.source,
      variables: body.variables,
      rows: (body.rows ?? []).map((row) => ({
        id: row.id ?? nanoid(),
        lyric: row.lyric,
        timeMs: row.timeMs,
      })),
    })
  })

  app.get('/api/projects/:id', async (request) => {
    const { id } = request.params as { id: string }
    return store.get(id)
  })

  app.put('/api/projects/:id', async (request) => {
    const { id } = request.params as { id: string }
    const project = projectSchema.parse(request.body)
    const header = request.headers['if-match']
    const expected = Number(Array.isArray(header) ? header[0] : header)
    if (!Number.isFinite(expected)) throw new StoreError('REVISION_CONFLICT', '缺少 If-Match')
    return store.save(id, project, expected)
  })

  app.delete('/api/projects/:id', async (request) => {
    const { id } = request.params as { id: string }
    await store.remove(id)
    return { ok: true }
  })

  app.post('/api/projects/:id/export/xlsx', async (request, reply) => {
    const { id } = request.params as { id: string }
    const project = await store.get(id)
    const exportOptions = exportOptionsSchema.parse(request.body ?? {})
    const buffer = await writeXlsx(project, exportOptions)
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${encodeURIComponent(project.title)}-call-sheet.xlsx"`)
      .send(buffer)
  })

  if (options.serveStatic && existsSync(resolve('dist'))) {
    await app.register(fastifyStatic, { root: resolve('dist') })
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api/')) {
        return reply.status(404).send({ code: 'NOT_FOUND', message: '接口不存在' })
      }
      return reply.sendFile('index.html')
    })
  }

  return app
}
