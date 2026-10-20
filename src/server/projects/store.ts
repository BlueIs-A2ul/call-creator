import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { nanoid } from 'nanoid'
import type { Project, ProjectSummary, Row } from '@shared/types'

export class StoreError extends Error {
  constructor(
    public readonly code: 'NOT_FOUND' | 'REVISION_CONFLICT',
    message: string,
  ) {
    super(message)
    this.name = 'StoreError'
  }
}

export interface CreateProjectInput {
  title: string
  artist: string
  album?: string
  durationMs?: number
  source?: Project['source']
  rows: Row[]
  variables?: Record<string, string>
}

export interface ProjectStore {
  list(): Promise<ProjectSummary[]>
  get(id: string): Promise<Project>
  create(input: CreateProjectInput): Promise<Project>
  save(id: string, project: Project, expectedRevision: number): Promise<Project>
  remove(id: string): Promise<void>
}

export function createProjectStore(dataDir: string): ProjectStore {
  const projectsDir = join(dataDir, 'projects')

  async function ensureDir() {
    await mkdir(projectsDir, { recursive: true })
  }

  function fileOf(id: string) {
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new StoreError('NOT_FOUND', '项目 ID 不合法')
    return join(projectsDir, `${id}.json`)
  }

  async function readProject(id: string): Promise<Project> {
    try {
      return JSON.parse(await readFile(fileOf(id), 'utf8')) as Project
    } catch {
      throw new StoreError('NOT_FOUND', '项目不存在')
    }
  }

  async function writeAtomic(file: string, project: Project) {
    const temp = `${file}.${nanoid(6)}.tmp`
    await writeFile(temp, JSON.stringify(project, null, 2), 'utf8')
    await rename(temp, file)
  }

  return {
    async list() {
      await ensureDir()
      const files = (await readdir(projectsDir)).filter((file) => file.endsWith('.json'))
      const projects = await Promise.all(
        files.map(async (file) => {
          try {
            const project = JSON.parse(await readFile(join(projectsDir, file), 'utf8')) as Project
            return {
              id: project.id,
              title: project.title,
              artist: project.artist,
              updatedAt: project.updatedAt,
              rowCount: project.rows.length,
            }
          } catch {
            return null
          }
        }),
      )
      return projects
        .filter((project): project is ProjectSummary => project !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    },

    get: readProject,

    async create(input) {
      await ensureDir()
      const now = new Date().toISOString()
      const project: Project = {
        schemaVersion: 1,
        id: nanoid(12),
        title: input.title,
        artist: input.artist,
        album: input.album,
        durationMs: input.durationMs,
        source: input.source,
        rows: input.rows,
        variables: input.variables ?? {},
        revision: 0,
        createdAt: now,
        updatedAt: now,
      }
      await writeAtomic(fileOf(project.id), project)
      return project
    },

    async save(id, project, expectedRevision) {
      const current = await readProject(id)
      if (current.revision !== expectedRevision) {
        throw new StoreError('REVISION_CONFLICT', '项目已被其他窗口修改')
      }
      const next: Project = {
        ...project,
        id,
        revision: current.revision + 1,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
      }
      await writeAtomic(fileOf(id), next)
      return next
    },

    async remove(id) {
      await rm(fileOf(id), { force: true })
    },
  }
}
