import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { readFile, readdir } from 'node:fs/promises'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { hostname, platform, arch } from 'node:os'
import { vietnamDate } from '../../shared/request-options.mjs'
import { PASSWORD_ITERATIONS, PASSWORD_BYTES, PASSWORD_SCHEME } from '../../shared/password-policy.mjs'

export const backend = fileURLToPath(new URL('../', import.meta.url))
export const evidence = fileURLToPath(new URL('../../docs/evidence/', import.meta.url))

export function metadata() {
  return {
    measuredAt: new Date().toISOString(), businessDate: vietnamDate(new Date()),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8', windowsHide: true }).trim(),
    workingTree: execFileSync('git', ['status', '--porcelain'], { cwd: backend, encoding: 'utf8', windowsHide: true }).trim() ? 'modified' : 'clean',
    environment: 'LOCAL workerd / Miniflare + isolated D1 SQLite; not Cloudflare production',
    node: process.version, platform: `${platform()} ${arch()}`, device: hostname(), network: 'loopback',
  }
}

export async function startEnvironment({ assets = false, rateLimit = 10 } = {}) {
  const bundled = await build({
    entryPoints: [fileURLToPath(new URL('../src/index.js', import.meta.url))],
    bundle: true, format: 'esm', platform: 'browser', write: false,
  })
  const mf = new Miniflare(convertV4MiniflareOptions({
    host: '127.0.0.1', port: 0,
    workers: [{
      name: 'recycle-test', modules: true, script: bundled.outputFiles[0].text,
      compatibilityDate: '2026-11-19',
      d1Databases: { DB: 'isolated-test-database' }, d1Persist: false,
      ratelimits: { LOGIN_LIMITER: { namespace_id: '1001', simple: { limit: rateLimit, period: 60 } } },
      ...(assets ? { assets: {
        routerConfig: { has_user_worker: true },
        directory: typeof assets === 'string' ? assets : fileURLToPath(new URL('../../frontend/dist/', import.meta.url)),
        run_worker_first: ['/api/*'], assetConfig: { not_found_handling: 'single-page-application' },
      } } : {}),
    }],
  }))
  try {
    const base = (await mf.ready).origin
    const db = await mf.getD1Database('DB')
    const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8')
    await db.batch(schema.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean).map(s => db.prepare(s)))
    for (const file of (await readdir(new URL('../migrations/', import.meta.url))).filter(f => f.endsWith('.sql')).sort()) {
      const migration = await readFile(new URL('../migrations/' + file, import.meta.url), 'utf8')
      // Every statement in this migration is a trigger with internal semicolons.
      const statements = migration.replace(/--[^\n]*/g, '').split(/END;/i).map(s => s.trim()).filter(Boolean)
      await db.batch(statements.map(statement => db.prepare(statement + '\nEND;')))
    }
    const password = randomBytes(24).toString('base64url')
    const salt = randomBytes(32).toString('hex')
    const hash = `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${salt}$${pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_BYTES, 'sha256').toString('hex')}`
    for (const [username, role, area] of [
      ['D01', 'DAN', null], ['D02', 'DAN', null], ['TG01', 'THUGOM', 'KHU_VUC_1'],
      ['TG02', 'THUGOM', 'KHU_VUC_2'], ['AD01', 'ADMIN', null],
    ]) {
      await db.prepare('INSERT INTO Users (Username, PasswordHash, FullName, Role, ServiceArea, CreatedAt) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(username, hash, `Test ${username}`, role, area, new Date().toISOString()).run()
    }
    async function api(path, { cookie, method = 'GET', body, headers = {} } = {}) {
      const response = await fetch(base + path, {
        method, headers: { ...(method === 'POST' ? { Origin: base } : {}),
          ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      return { status: response.status, body: await response.json().catch(() => null), headers: response.headers }
    }
    async function login(username, headers) {
      const response = await api('/api/auth/login', { method: 'POST', body: { username, password }, headers })
      if (response.status !== 200) throw new Error(`Login ${username}: HTTP ${response.status} ${JSON.stringify(response.body)}`)
      return { cookie: response.headers.get('set-cookie').split(';')[0], user: response.body.user, response }
    }
    return { mf, db, base, password, api, login, close: () => mf.dispose() }
  } catch (error) {
    await mf.dispose()
    throw error
  }
}

export function requestBody(overrides = {}) {
  return { wasteType: 'GIAY', quantityKg: 5, address: 'Địa chỉ kiểm thử local', area: 'KHU_VUC_1',
    preferredDate: vietnamDate(new Date()), note: 'Dữ liệu thử nghiệm', ...overrides }
}
