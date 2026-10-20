import Fastify from 'fastify'

const app = Fastify({ logger: false })
const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'

app.get('/api/health', async () => ({ ok: true }))

await app.listen({ port, host })
console.log(`callCreator api listening on http://${host}:${port}`)
