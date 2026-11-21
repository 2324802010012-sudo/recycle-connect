import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startEnvironment, requestBody, evidence, metadata } from './environment.mjs'
import { browserExecutable } from './browser.mjs'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const temporary = await mkdtemp(join(tmpdir(), 'recycle-polling-'))
const frontend = fileURLToPath(new URL('../../frontend/', import.meta.url))
const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true })
const results = []
try {
  for (const intervalMs of [2000, 5000, 10000]) {
    const directory = join(temporary, String(intervalMs))
    const build = spawnSync(process.execPath, [join(frontend, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', directory], {
      cwd: frontend, env: { ...process.env, VITE_POLL_INTERVAL_MS: String(intervalMs) }, encoding: 'utf8', windowsHide: true,
    })
    assert.equal(build.status, 0, build.stderr)
    const env = await startEnvironment({ assets: directory })
    const contexts = []
    try {
      const dan = await env.login('D01'), collector = await env.login('TG01')
      const ids = []
      for (let i = 0; i < 5; i++) {
        const response = await env.api('/api/requests', { method: 'POST', cookie: dan.cookie, body: requestBody() })
        assert.equal(response.status, 201); ids.push(response.body.data.requestId)
      }
      async function pageFor(session, route) {
        const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
        contexts.push(context)
        const url = new URL(env.base)
        await context.addCookies([{ name: 'rc_session', value: session.cookie.split('=')[1], domain: url.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }])
        const page = await context.newPage()
        await page.goto(env.base + route)
        await page.getByRole('button', { name: 'Đăng xuất', exact: true }).waitFor()
        return page
      }
      const observer = await pageFor(dan, '/dan'), actor = await pageFor(collector, '/thugom')
      await observer.getByRole('article').first().waitFor()
      await observer.evaluate(ids => {
        window.seenTransitions = {}
        const inspect = () => {
          for (const article of document.querySelectorAll('article')) {
            const id = Number(article.querySelector('h3')?.textContent.match(/#(\d+)/)?.[1])
            if (ids.includes(id) && article.textContent.includes('Đã nhận') && !window.seenTransitions[id]) window.seenTransitions[id] = Date.now()
          }
        }
        window.transitionObserver = new MutationObserver(inspect)
        window.transitionObserver.observe(document.body, { childList: true, subtree: true, characterData: true })
      }, ids)
      const started = Date.now(), gets = [], samples = []
      observer.on('request', request => {
        if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/requests/mine') gets.push(Date.now())
      })
      for (const requestId of ids) {
        const offsetMs = Math.floor(Math.random() * intervalMs)
        await sleep(offsetMs)
        const post = await actor.evaluate(async id => {
          const response = await fetch(`/api/requests/${id}/accept`, { method: 'POST' })
          await response.json()
          return { status: response.status, acknowledgedAt: Date.now() }
        }, requestId)
        assert.equal(post.status, 200)
        await observer.waitForFunction(id => Boolean(window.seenTransitions[id]), requestId, { timeout: intervalMs + 15000 })
        const visibleAt = await observer.evaluate(id => window.seenTransitions[id], requestId)
        samples.push({ requestId, offsetMs, ...post, visibleAt, delayMs: visibleAt - post.acknowledgedAt })
        const saved = await env.db.prepare('SELECT Status, CollectorId, AcceptedAt FROM Requests WHERE RequestId = ?').bind(requestId).first()
        assert.equal(saved.Status, 'DA_NHAN')
        console.log(`TN02 ${intervalMs}ms, sample ${samples.length}/5: ${visibleAt - post.acknowledgedAt}ms`)
      }
      const remaining = Math.max(0, 60000 - (Date.now() - started))
      if (remaining) await sleep(remaining)
      const observationMs = Date.now() - started
      results.push({ intervalMs, samples, meanDelayMs: samples.reduce((sum, sample) => sum + sample.delayMs, 0) / samples.length,
        maxDelayMs: Math.max(...samples.map(s => s.delayMs)), observationMs, getCount: gets.length,
        getsPerMinute: gets.length * 60000 / observationMs, endpoint: 'GET /api/requests/mine', getStartedAt: gets })
      console.log(`TN02 ${intervalMs}ms complete: ${gets.length} GET / ${observationMs}ms`)
    } finally {
      for (const context of contexts) await context.close()
      await env.close()
    }
  }
} finally {
  await mkdir(evidence, { recursive: true })
  await writeFile(evidence + 'tn02.json', JSON.stringify({ ...metadata(), browser: await browser.version(),
    method: 'Two independent browser cookie contexts. Real timers. MutationObserver records rendered citizen card; POST completion timestamp in collector browser. Random phase offsets. At least 60s GET observation per interval. Alternate builds in temporary directories; default frontend/dist untouched.',
    results }, null, 2) + '\n')
  await browser.close()
  // Delete only this run's mkdtemp directory, after checking its absolute scope.
  const target = resolve(temporary), parent = resolve(tmpdir()) + sep
  if (!target.startsWith(parent) || !target.slice(parent.length).startsWith('recycle-polling-')) throw new Error('Unsafe temporary cleanup target')
  await rm(target, { recursive: true, force: true })
}
