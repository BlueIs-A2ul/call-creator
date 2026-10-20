import { buildApp } from './app'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'
const dataDir = process.env.DATA_DIR ?? 'data'

const app = await buildApp({
  dataDir,
  serveStatic: true,
  libraryUrl: process.env.LIBRARY_URL,
})

await app.listen({ port, host })
console.log(`callCreator listening on http://${host}:${port}`)
