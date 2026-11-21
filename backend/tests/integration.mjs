import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { startEnvironment, requestBody, evidence, metadata } from './environment.mjs'

const env = await startEnvironment()
const { api, db, login } = env
const results = []
const races = []
let dan, otherDan, tg1, tg2, admin, id, winner, loser
async function check(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`) }
  catch (error) { results.push({ name, status: 'FAIL', reason: error.message }); console.error(`FAIL ${name}: ${error.message}`) }
}
async function expectStatus(path, options, status) {
  const response = await api(path, options)
  assert.equal(response.status, status, `${path}: ${JSON.stringify(response.body)}`)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  if (status >= 400) {
    assert.equal(response.body.success, false)
    assert.equal(typeof response.body.error.code, 'string')
  }
  return response
}
const post = (cookie, body) => ({ method: 'POST', cookie, ...(body !== undefined ? { body } : {}) })
const logs = requestId => db.prepare('SELECT ActorId, Action, CreatedAt FROM RequestLogs WHERE RequestId = ? ORDER BY LogId').bind(requestId).all()
const row = requestId => db.prepare('SELECT * FROM Requests WHERE RequestId = ?').bind(requestId).first()

try {
  await check('TC01: login DAN, two THUGOM, ADMIN; seed Node hash verified in Worker', async () => {
    dan = await login('D01'); otherDan = await login('D02'); tg1 = await login('TG01'); tg2 = await login('TG02'); admin = await login('AD01')
    assert.deepEqual([dan.user.role, tg1.user.role, admin.user.role], ['DAN', 'THUGOM', 'ADMIN'])
    assert.deepEqual(dan.response.body.data.user, dan.response.body.user)
    assert.match(dan.response.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Path=\/; Max-Age=28800/)
    const sessions = (await db.prepare('SELECT TokenHash, CreatedAt, ExpiresAt FROM Sessions').all()).results
    assert.equal(sessions.length, 5)
    for (const session of sessions) {
      assert.match(session.TokenHash, /^[a-f0-9]{64}$/)
      assert.ok(Date.parse(session.ExpiresAt) - Date.parse(session.CreatedAt) <= 8 * 3600000)
      assert.notEqual(session.TokenHash, dan.cookie.split('=')[1])
    }
  })
  await check('TC02: wrong password, unknown user, invalid JSON/types, Origin', async () => {
    const wrong = await expectStatus('/api/auth/login', post(null, { username: 'D01', password: env.password + 'x' }), 401)
    const unknown = await expectStatus('/api/auth/login', post(null, { username: 'absent', password: env.password }), 401)
    assert.deepEqual(wrong.body, unknown.body)
    for (const body of [null, [], {}, { username: 5, password: 'abc' }, { username: 'D01', password: {} }]) {
      await expectStatus('/api/auth/login', post(null, body), 400)
    }
    await expectStatus('/api/requests', { ...post(dan.cookie, requestBody()), headers: { Origin: 'https://foreign.example' } }, 403)
    await expectStatus('/api/requests', { ...post(dan.cookie, requestBody()), headers: { Origin: '' } }, 403)
    const malformed = await fetch(env.base + '/api/auth/login', { method: 'POST', headers: { Origin: env.base, 'Content-Type': 'application/json' }, body: '{' })
    assert.equal(malformed.status, 400)
  })
  await check('TC03: create, immutable server ownership/status, atomic CREATE', async () => {
    const created = await expectStatus('/api/requests', post(dan.cookie, requestBody({ userId: 999, collectorId: tg1.user.userId, status: 'HOAN_THANH' })), 201)
    id = created.body.data.requestId
    const saved = await row(id)
    assert.equal(saved.UserId, dan.user.userId)
    assert.equal(saved.Status, 'CHO_NHAN'); assert.equal(saved.CollectorId, null)
    assert.equal(saved.AcceptedAt, null); assert.equal(saved.CompletedAt, null)
    assert.deepEqual((await logs(id)).results, [{ ActorId: dan.user.userId, Action: 'CREATE', CreatedAt: saved.CreatedAt }])
  })
  await check('TC04: invalid payloads leave Requests and RequestLogs unchanged', async () => {
    const before = await db.prepare('SELECT (SELECT COUNT(*) FROM Requests) AS r, (SELECT COUNT(*) FROM RequestLogs) AS l').first()
    for (const body of [null, [], {}, requestBody({ quantityKg: 0 }), requestBody({ quantityKg: -1 }), requestBody({ quantityKg: 1001 }),
      requestBody({ quantityKg: '5' }), requestBody({ address: 'tiny' }), requestBody({ address: 'x'.repeat(201) }),
      requestBody({ note: 'x'.repeat(501) }), requestBody({ note: null }), requestBody({ wasteType: 'OTHER' }),
      requestBody({ area: 'UNKNOWN' }), requestBody({ preferredDate: '2027-02-29' }), requestBody({ preferredDate: '2000-01-01' }),
      requestBody({ preferredDate: '2027-13-01' })]) await expectStatus('/api/requests', post(dan.cookie, body), 400)
    assert.deepEqual(await db.prepare('SELECT (SELECT COUNT(*) FROM Requests) AS r, (SELECT COUNT(*) FROM RequestLogs) AS l').first(), before)
  })
  await check('TC05: second citizen cannot read another citizen request', async () => {
    await expectStatus(`/api/requests/${id}`, { cookie: otherDan.cookie }, 404)
    assert.equal((await expectStatus('/api/requests/mine', { cookie: otherDan.cookie }, 200)).body.data.pagination.total, 0)
  })
  await check('TC06/TC07/TN01: 10 real simultaneous HTTP accept races, D1 invariant', async () => {
    for (let i = 0; i < 10; i++) {
      const created = await expectStatus('/api/requests', post(dan.cookie, requestBody()), 201)
      const requestId = created.body.data.requestId
      const responses = await Promise.all([api(`/api/requests/${requestId}/accept`, post(tg1.cookie)), api(`/api/requests/${requestId}/accept`, post(tg2.cookie))])
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409])
      const saved = await row(requestId)
      const accept = (await logs(requestId)).results.filter(l => l.Action === 'ACCEPT')
      const winnerIndex = responses.findIndex(r => r.status === 200)
      const winningUser = [tg1, tg2][winnerIndex]
      assert.equal(saved.CollectorId, winningUser.user.userId)
      assert.equal(saved.Status, 'DA_NHAN'); assert.ok(saved.AcceptedAt)
      assert.equal(accept.length, 1); assert.equal(accept[0].ActorId, saved.CollectorId); assert.equal(accept[0].CreatedAt, saved.AcceptedAt)
      races.push({ requestId, http: responses.map(r => r.status), collectorId: saved.CollectorId, acceptedAt: saved.AcceptedAt, acceptLogs: accept.length })
    }
    winner = tg1; loser = tg2
    await expectStatus(`/api/requests/${id}/accept`, post(winner.cookie), 200)
    await expectStatus(`/api/requests/${id}/accept`, post(loser.cookie), 409)
  })
  await check('TC08: other collector forbidden to complete and hidden from detail', async () => {
    await expectStatus(`/api/requests/${id}/complete`, post(loser.cookie), 403)
    await expectStatus(`/api/requests/${id}`, { cookie: loser.cookie }, 404)
    assert.equal((await row(id)).Status, 'DA_NHAN')
    assert.equal((await logs(id)).results.length, 2)
  })
  await check('TC09: owner completes once; repeat operations conflict', async () => {
    await expectStatus(`/api/requests/${id}/complete`, post(winner.cookie), 200)
    await expectStatus(`/api/requests/${id}/complete`, post(winner.cookie), 409)
    await expectStatus(`/api/requests/${id}/accept`, post(winner.cookie), 409)
    assert.equal((await row(id)).Status, 'HOAN_THANH')
    assert.equal((await logs(id)).results.length, 3)
  })
  await check('TC10/TC19: real ordered timeline, action, actor and timestamp', async () => {
    const detail = (await expectStatus(`/api/requests/${id}`, { cookie: dan.cookie }, 200)).body.data
    const history = (await logs(id)).results
    assert.deepEqual(history.map(l => l.Action), ['CREATE', 'ACCEPT', 'COMPLETE'])
    assert.deepEqual(history.map(l => l.ActorId), [dan.user.userId, winner.user.userId, winner.user.userId])
    assert.deepEqual(history.map(l => l.CreatedAt), [detail.createdAt, detail.acceptedAt, detail.completedAt])
    assert.ok(detail.createdAt <= detail.acceptedAt && detail.acceptedAt <= detail.completedAt)
    assert.ok(history.every(l => /^\d{4}-\d{2}-\d{2}T.*Z$/.test(l.CreatedAt)))
  })
  await check('TC12: stats and 14-day series match independent SQL', async () => {
    const stats = (await expectStatus('/api/admin/stats', { cookie: admin.cookie }, 200)).body.data
    assert.equal(stats.total, (await db.prepare('SELECT COUNT(*) AS n FROM Requests').first()).n)
    for (const [status, n] of Object.entries(stats.byStatus)) assert.equal(n, (await db.prepare('SELECT COUNT(*) AS n FROM Requests WHERE Status = ?').bind(status).first()).n)
    for (const { wasteType, count } of stats.byWasteType) assert.equal(count, (await db.prepare('SELECT COUNT(*) AS n FROM Requests WHERE WasteType = ?').bind(wasteType).first()).n)
    assert.equal(stats.byDay.length, 14)
    for (const day of stats.byDay) {
      for (const [metric, field] of [['created', 'CreatedAt'], ['completed', 'CompletedAt']]) {
        assert.equal(day[metric], (await db.prepare(`SELECT COUNT(*) AS n FROM Requests WHERE date(${field}, '+7 hours') = ?`).bind(day.date).first()).n)
      }
    }
  })
  await check('TC13 implementation only: optional priority scores, stable ties, pagination', async () => {
    const ids = []
    // Create valid historical fixtures directly, without changing existing rows.
    const createdAt = new Date(Date.now() - 86400000).toISOString()
    for (let i = 0; i < 3; i++) {
      const result = await db.prepare(`INSERT INTO Requests (UserId, WasteType, QuantityKg, Address, Area, PreferredDate, CreatedAt)
        VALUES (?, 'GIAY', 5, 'Địa chỉ thử nghiệm', 'KHU_VUC_1', ?, ?) RETURNING RequestId`)
        .bind(dan.user.userId, requestBody().preferredDate, createdAt).first()
      ids.push(result.RequestId)
      await db.prepare("INSERT INTO RequestLogs (RequestId, ActorId, Action, CreatedAt) VALUES (?, ?, 'CREATE', ?)")
        .bind(result.RequestId, dan.user.userId, createdAt).run()
    }
    const first = (await expectStatus('/api/requests/available?priority=1&limit=2', { cookie: tg1.cookie }, 200)).body.data
    const second = (await expectStatus('/api/requests/available?priority=1&limit=2&page=2', { cookie: tg1.cookie }, 200)).body.data
    assert.deepEqual([...first.items, ...second.items].map(r => r.requestId), ids)
    assert.ok(first.items.every(r => r.priorityScore === 90))
    assert.equal(second.pagination.total, 3)
  })
  await check('TC16: session restored; expired and malformed sessions rejected', async () => {
    assert.equal((await expectStatus('/api/auth/me', { cookie: dan.cookie }, 200)).body.user.userId, dan.user.userId)
    await expectStatus('/api/auth/me', { cookie: 'rc_session=malformed' }, 401)
    const session = await login('D02', { 'CF-Connecting-IP': '192.0.2.16' })
    const tokenHash = createHash('sha256').update(session.cookie.split('=')[1]).digest('hex')
    await db.prepare('UPDATE Sessions SET ExpiresAt = ? WHERE TokenHash = ?').bind(new Date(Date.now() - 1000).toISOString(), tokenHash).run()
    await expectStatus('/api/auth/me', { cookie: session.cookie }, 401)
  })
  await check('TC17: pending privacy, authorized full detail, 404 non-existent IDs', async () => {
    const available = (await expectStatus('/api/requests/available', { cookie: tg1.cookie }, 200)).body.data.items
    assert.ok(available.length)
    for (const item of available) {
      assert.equal(Object.hasOwn(item, 'address'), false); assert.equal(Object.hasOwn(item, 'note'), false)
      const detail = (await expectStatus(`/api/requests/${item.requestId}`, { cookie: tg2.cookie }, 200)).body.data
      assert.equal(Object.hasOwn(detail, 'address'), false); assert.equal(Object.hasOwn(detail, 'note'), false)
    }
    assert.equal(typeof (await expectStatus(`/api/requests/${id}`, { cookie: winner.cookie }, 200)).body.data.address, 'string')
    for (const action of ['', '/accept', '/complete']) await expectStatus('/api/requests/999999' + action, action ? post(tg1.cookie) : { cookie: admin.cookie }, 404)
  })
  await check('TC18: all endpoint role restrictions via direct HTTP', async () => {
    const routes = [
      ['GET', '/api/requests/mine', 'DAN'], ['POST', '/api/requests', 'DAN'],
      ['GET', '/api/requests/available', 'THUGOM'], ['GET', '/api/requests/assigned', 'THUGOM'],
      ['POST', `/api/requests/${id}/accept`, 'THUGOM'], ['POST', `/api/requests/${id}/complete`, 'THUGOM'],
      ['GET', '/api/admin/requests', 'ADMIN'], ['GET', '/api/admin/stats', 'ADMIN'],
    ]
    for (const [method, path, role] of routes) {
      await expectStatus(path, { method, ...(method === 'POST' ? { body: requestBody() } : {}) }, 401)
      for (const session of [dan, tg1, admin].filter(s => s.user.role !== role)) {
        await expectStatus(path, { method, cookie: session.cookie, ...(method === 'POST' ? { body: requestBody() } : {}) }, 403)
      }
    }
  })
  await check('TC20: filters, pagination bounds, invalid dates, SQL input', async () => {
    for (const query of ['page=0', 'page=-1', 'page=1.5', 'limit=51', 'limit=0', 'page=9007199254740992', 'status=BAD', 'wasteType=BAD', 'from=2027-02-29', 'from=2027-02-01&to=2027-01-01']) {
      await expectStatus('/api/admin/requests?' + query, { cookie: admin.cookie }, 400)
    }
    await expectStatus('/api/requests/available?area=BAD', { cookie: tg1.cookie }, 400)
    await expectStatus('/api/requests/available?priority=BAD', { cookie: tg1.cookie }, 400)
    await expectStatus('/api/admin/requests?wasteType=%27%20OR%201%3D1--', { cookie: admin.cookie }, 400)
    const filtered = (await expectStatus('/api/requests/mine?status=HOAN_THANH&limit=1', { cookie: dan.cookie }, 200)).body.data
    assert.equal(filtered.pagination.total, 1); assert.equal(filtered.byStatus.HOAN_THANH, 1)
    assert.equal(filtered.items[0].requestId, id)
    const pages = []
    for (let page = 1; page <= 7; page++) {
      const data = (await expectStatus(`/api/admin/requests?page=${page}&limit=2`, { cookie: admin.cookie }, 200)).body.data
      pages.push(...data.items.map(r => r.requestId))
    }
    assert.equal(pages.length, new Set(pages).size)
    const saved = await row(id)
    const date = saved.CreatedAt.slice(0, 10)
    const dated = (await expectStatus(`/api/admin/requests?status=HOAN_THANH&wasteType=GIAY&from=${date}&to=${date}`, { cookie: admin.cookie }, 200)).body.data
    assert.ok(dated.items.every(r => r.status === 'HOAN_THANH' && r.wasteType === 'GIAY'))
    const empty = (await expectStatus('/api/admin/requests?page=999&limit=20', { cookie: admin.cookie }, 200)).body.data
    assert.equal(empty.items.length, 0)
    const boundaryIds = []
    for (const timestamp of ['2026-11-20T16:59:59.999Z', '2026-11-20T17:00:00.000Z']) {
      const fixture = await db.prepare(`INSERT INTO Requests (UserId, WasteType, QuantityKg, Address, Area, PreferredDate, CreatedAt)
        VALUES (?, 'NHUA', 1, 'Test timezone boundary', 'KHU_VUC_2', '2027-01-01', ?) RETURNING RequestId`)
        .bind(dan.user.userId, timestamp).first()
      boundaryIds.push(fixture.RequestId)
      await db.prepare("INSERT INTO RequestLogs (RequestId, ActorId, Action, CreatedAt) VALUES (?, ?, 'CREATE', ?)")
        .bind(fixture.RequestId, dan.user.userId, timestamp).run()
    }
    const vietnamDay = (await expectStatus('/api/admin/requests?from=2026-11-21&to=2026-11-21&wasteType=NHUA', { cookie: admin.cookie }, 200)).body.data
    assert.deepEqual(vietnamDay.items.map(r => r.requestId), [boundaryIds[1]])
  })
  await check('Atomicity: CREATE/ACCEPT/COMPLETE log failures roll back state', async () => {
    for (const action of ['CREATE', 'ACCEPT', 'COMPLETE']) {
      let requestId
      if (action !== 'CREATE') requestId = (await expectStatus('/api/requests', post(dan.cookie, requestBody()), 201)).body.data.requestId
      if (action === 'COMPLETE') await expectStatus(`/api/requests/${requestId}/accept`, post(tg1.cookie), 200)
      const before = requestId ? await row(requestId) : await db.prepare('SELECT COUNT(*) AS n FROM Requests').first()
      await db.prepare(`CREATE TRIGGER test_log_failure BEFORE INSERT ON RequestLogs WHEN NEW.Action = '${action}' BEGIN SELECT RAISE(ABORT, 'injected test failure'); END`).run()
      try {
        const path = action === 'CREATE' ? '/api/requests' : `/api/requests/${requestId}/${action.toLowerCase()}`
        await expectStatus(path, post(action === 'CREATE' ? dan.cookie : tg1.cookie, action === 'CREATE' ? requestBody() : undefined), 500)
        const after = requestId ? await row(requestId) : await db.prepare('SELECT COUNT(*) AS n FROM Requests').first()
        assert.deepEqual(after, before)
      } finally { await db.prepare('DROP TRIGGER test_log_failure').run() }
    }
  })
  await check('Concurrent CREATE: each log references the correct new row/actor', async () => {
    const created = await Promise.all(Array.from({ length: 8 }, (_, i) => api('/api/requests', post(i % 2 ? dan.cookie : otherDan.cookie, requestBody()))))
    assert.ok(created.every(r => r.status === 201))
    for (const response of created) {
      const saved = await row(response.body.data.requestId)
      const history = (await logs(saved.RequestId)).results
      assert.equal(history.length, 1); assert.equal(history[0].ActorId, saved.UserId); assert.equal(history[0].CreatedAt, saved.CreatedAt)
    }
  })
  await check('Migration: fixed four business tables, guards reject invalid SQL without data loss', async () => {
    const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results.map(r => r.name).sort()
    assert.deepEqual(tables, ['RequestLogs', 'Requests', 'Sessions', 'Users'])
    const saved = await row(id)
    for (const statement of [
      db.prepare("UPDATE Requests SET Status = 'CHO_NHAN', CollectorId = NULL, AcceptedAt = NULL, CompletedAt = NULL WHERE RequestId = ?").bind(id),
      db.prepare("UPDATE Requests SET Address = 'Changed address' WHERE RequestId = ?").bind(id),
      db.prepare("INSERT INTO Requests (UserId, WasteType, QuantityKg, Address, Area, PreferredDate, CreatedAt) VALUES (?, 'GIAY', 1, 'Test address', 'UNKNOWN', '2027-01-01', ?)").bind(dan.user.userId, new Date().toISOString()),
    ]) await assert.rejects(() => statement.run())
    assert.deepEqual(await row(id), saved)
  })
  await check('TC15: logout revokes D1 token, replay and repeated logout rejected', async () => {
    await expectStatus('/api/auth/logout', post(otherDan.cookie), 204)
    await expectStatus('/api/auth/me', { cookie: otherDan.cookie }, 401)
    const repeated = await expectStatus('/api/auth/logout', post(otherDan.cookie), 401)
    assert.match(repeated.headers.get('set-cookie'), /Max-Age=0/)
    const tokenHash = createHash('sha256').update(otherDan.cookie.split('=')[1]).digest('hex')
    assert.ok((await db.prepare('SELECT RevokedAt FROM Sessions WHERE TokenHash = ?').bind(tokenHash).first()).RevokedAt)
  })
  await check('Login rate limit: HTTP 429 before password hashing', async () => {
    // Independent instance avoids a shared local IP/window from earlier tests.
    // A threshold of one checks the error path without spending CPU on ten hashes.
    const limited = await startEnvironment({ rateLimit: 1 })
    try {
      const statuses = []
      let response
      for (let i = 0; i < 20; i++) {
        response = await limited.api('/api/auth/login', post(null, { username: 'D01', password: limited.password + 'wrong' }))
        statuses.push(response.status)
        if (response.status === 429) break
      }
      assert.equal(response.status, 429, `Local limiter responses: ${statuses.join(',')}`)
      assert.equal(response.headers.get('retry-after'), '60')
    } finally { await limited.close() }
  })
} finally {
  await mkdir(evidence, { recursive: true })
  await writeFile(evidence + 'integration.json', JSON.stringify({ ...metadata(), results, tn01: { trials: races.length, races,
    successes: races.flatMap(r => r.http).filter(s => s === 200).length,
    conflicts: races.flatMap(r => r.http).filter(s => s === 409).length } }, null, 2) + '\n')
  await env.close()
}
if (results.some(r => r.status === 'FAIL')) process.exitCode = 1
