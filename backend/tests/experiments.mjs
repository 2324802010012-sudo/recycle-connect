import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { startEnvironment, requestBody, evidence, metadata } from './environment.mjs'

const env = await startEnvironment()
const measurements = []
const results = []
async function measure(method, path, options = {}) {
  const start = performance.now()
  const response = await env.api(path, { ...options, method })
  measurements.push({ endpoint: `${method} ${path.replace(/\/\d+(?=\/|$)/g, '/:id')}`, ms: performance.now() - start, status: response.status })
  assert.ok(response.status < 400, `HTTP ${response.status} ${method} ${path}`)
  return response
}
try {
  const dan = await env.login('D01'), tg = await env.login('TG01'), admin = await env.login('AD01')
  const ids = []
  for (let i = 0; i < 20; i++) {
    const created = await measure('POST', '/api/requests', { cookie: dan.cookie, body: requestBody() })
    ids.push(created.body.data.requestId)
  }
  for (let i = 0; i < 20; i++) await measure('GET', '/api/requests/available', { cookie: tg.cookie })
  for (const id of ids) await measure('POST', `/api/requests/${id}/accept`, { cookie: tg.cookie })
  for (let i = 0; i < 20; i++) await measure('GET', '/api/requests/assigned', { cookie: tg.cookie })
  for (const id of ids) await measure('POST', `/api/requests/${id}/complete`, { cookie: tg.cookie })
  for (let i = 0; i < 20; i++) {
    await measure('GET', '/api/auth/me', { cookie: dan.cookie })
    await measure('GET', '/api/requests/mine', { cookie: dan.cookie })
    await measure('GET', `/api/requests/${ids[i]}`, { cookie: dan.cookie })
    await measure('GET', '/api/admin/requests', { cookie: admin.cookie })
    await measure('GET', '/api/admin/stats', { cookie: admin.cookie })
  }
  // Separate small concurrency level, read-only; not mixed into sequential samples.
  const concurrent = []
  for (let group = 0; group < 5; group++) {
    concurrent.push(...await Promise.all(Array.from({ length: 4 }, async () => {
      const start = performance.now()
      const response = await env.api('/api/requests/mine', { cookie: dan.cookie })
      return { ms: performance.now() - start, status: response.status }
    })))
  }
  const summarize = rows => {
    const sorted = rows.map(r => r.ms).sort((a, b) => a - b)
    return { n: rows.length, meanMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
      p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1),
      http: Object.fromEntries([...new Set(rows.map(r => r.status))].map(status => [status, rows.filter(r => r.status === status).length])),
      error429or5xxRate: rows.filter(r => r.status === 429 || r.status >= 500).length / rows.length }
  }
  for (const endpoint of new Set(measurements.map(m => m.endpoint))) results.push({ endpoint, concurrency: 1, ...summarize(measurements.filter(m => m.endpoint === endpoint)) })
  results.push({ endpoint: 'GET /api/requests/mine', concurrency: 4, ...summarize(concurrent) })
  console.table(results)
  await mkdir(evidence, { recursive: true })
  await writeFile(evidence + 'tn03.json', JSON.stringify({ ...metadata(), method: 'Node fetch, headers through fully consumed JSON, sequential 20 samples/endpoint; nearest-rank p95; no warmup excluded', results, measurements, concurrent }, null, 2) + '\n')
} finally { await env.close() }
