import { chromium } from 'playwright-core'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { startEnvironment, evidence, metadata, requestBody } from './environment.mjs'
import { vietnamDate } from '../../shared/request-options.mjs'

export function browserExecutable() {
  const candidates = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  const executablePath = candidates.find(path => path && existsSync(path))
  if (!executablePath) throw new Error('Set BROWSER_PATH to installed Edge/Chromium executable.')
  return executablePath
}

// Reused by the polling experiment; importing this module must not run the suite.
export async function runBrowserSuite() {
  const env = await startEnvironment({ assets: true, rateLimit: 100 })
  const browser = await chromium.launch({ executablePath: browserExecutable(), headless: true })
  const results = [], errors = []
  await mkdir(evidence + 'screenshots', { recursive: true })
  async function check(name, fn) {
    try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name) }
    catch (error) { results.push({ name, status: 'FAIL', reason: error.message }); console.error('FAIL ' + name + ': ' + error.message) }
  }
  async function session(username, path) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
    context.setDefaultTimeout(15000)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(env.base + '/login')
    await page.getByLabel('Tên đăng nhập').fill(username)
    await page.getByLabel('Mật khẩu', { exact: true }).fill(env.password)
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await page.waitForURL('**' + path)
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).waitFor()
    return { context, page }
  }
  async function screenshot(page, name) {
    const fullPage = page.viewportSize().width > 600 && await page.getByRole('dialog').count() === 0
    await page.screenshot({ path: evidence + `screenshots/${name}.png`, fullPage })
  }
  let dan, tg1, tg2, admin, requestId
  try {
    await check('M01/M02/M04/M05 desktop: real browser login for all roles', async () => {
      dan = await session('D01', '/dan'); tg1 = await session('TG01', '/thugom')
      tg2 = await session('TG02', '/thugom'); admin = await session('AD01', '/admin')
      await dan.page.getByText('Chưa có yêu cầu', { exact: true }).waitFor()
      await screenshot(dan.page, 'desktop-dan-empty')
    })
    await check('M03: validation, back navigation, retained form, double-submit protection', async () => {
      const page = dan.page
      await page.getByRole('link', { name: 'Tạo yêu cầu thu gom' }).click()
      await page.getByRole('button', { name: 'Tiếp tục' }).click()
      await page.getByRole('alert').filter({ hasText: 'Vui lòng chọn loại rác' }).waitFor()
      await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Giấy', exact: true }) }).click()
      await page.getByLabel('Khối lượng dự kiến').fill('5')
      await page.getByRole('button', { name: 'Tiếp tục' }).click()
      await page.getByLabel('Địa chỉ thu gom').fill('Địa chỉ thử nghiệm giao diện')
      await page.getByLabel('Khu vực', { exact: true }).selectOption('KHU_VUC_1')
      await page.getByLabel('Ngày mong muốn').fill(vietnamDate(new Date()))
      await page.getByLabel('Ghi chú').fill('<img src=x onerror=alert(1)>')
      await page.getByRole('button', { name: 'Quay lại' }).click()
      assert.equal(await page.getByLabel('Khối lượng dự kiến').inputValue(), '5')
      await page.getByRole('button', { name: 'Tiếp tục' }).click()
      assert.equal(await page.getByLabel('Địa chỉ thu gom').inputValue(), 'Địa chỉ thử nghiệm giao diện')
      await page.getByRole('button', { name: 'Tiếp tục' }).click()
      await screenshot(page, 'desktop-form-confirm')
      let posts = 0
      page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/requests') posts++ })
      await page.getByRole('button', { name: 'Xác nhận yêu cầu', exact: true }).evaluate(button => { button.click(); button.click() })
      await page.waitForURL('**/dan')
      await page.getByRole('status').filter({ hasText: 'Đã tạo yêu cầu thu gom.' }).waitFor()
      assert.equal(posts, 1)
      const saved = await env.db.prepare('SELECT RequestId FROM Requests').all()
      assert.equal(saved.results.length, 1); requestId = saved.results[0].RequestId
    })
    await check('TC11: independent sessions observe CREATE and ACCEPT through 5s polling', async () => {
      const card1 = tg1.page.getByRole('article').filter({ hasText: `Yêu cầu #${requestId}` })
      const card2 = tg2.page.getByRole('article').filter({ hasText: `Yêu cầu #${requestId}` })
      await card1.waitFor({ timeout: 15000 }); await card2.waitFor({ timeout: 15000 })
      await card1.getByRole('button', { name: 'Nhận yêu cầu' }).click()
      await tg1.page.getByRole('status').filter({ hasText: 'Đã nhận yêu cầu.' }).waitFor()
      await dan.page.getByRole('article').filter({ hasText: `Yêu cầu #${requestId}` }).getByText('Đã nhận', { exact: true }).waitFor({ timeout: 15000 })
    })
    await check('TC14/409: stale second collector receives conflict and refreshes', async () => {
      // Render a real pending request, then accept it in a different independent session.
      const d = await env.login('D01')
      const t = await env.login('TG01')
      const created = await env.api('/api/requests', { method: 'POST', cookie: d.cookie, body: requestBody() })
      const raceId = created.body.data.requestId
      const page = tg2.page
      const card = page.getByRole('article').filter({ hasText: `Yêu cầu #${raceId}` })
      await card.waitFor({ timeout: 15000 })
      assert.equal((await env.api(`/api/requests/${raceId}/accept`, { method: 'POST', cookie: t.cookie })).status, 200)
      await card.getByRole('button', { name: 'Nhận yêu cầu' }).click()
      await page.getByRole('alert').filter({ hasText: 'Yêu cầu đã được tiếp nhận' }).waitFor()
      await card.waitFor({ state: 'detached' })
    })
    await check('M06: full timeline, escaped note, Escape and restored focus', async () => {
      const page = tg1.page
      await page.getByRole('button', { name: 'Đơn đã nhận', exact: true }).click()
      const card = page.getByRole('article').filter({ hasText: `Yêu cầu #${requestId}` })
      await card.getByRole('button', { name: 'Hoàn thành', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Đã hoàn thành yêu cầu.' }).waitFor()
      const citizenCard = dan.page.getByRole('article').filter({ hasText: `Yêu cầu #${requestId}` })
      await citizenCard.getByText('Hoàn thành', { exact: true }).waitFor({ timeout: 15000 })
      const trigger = citizenCard.getByRole('button', { name: 'Xem chi tiết' })
      await trigger.click()
      const dialog = dan.page.getByRole('dialog')
      await dialog.locator('time').first().waitFor()
      assert.equal(await dialog.locator('ol time').count(), 3)
      await dialog.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor()
      assert.equal(await dialog.locator('img').count(), 0)
      await screenshot(dan.page, 'desktop-detail-timeline')
      await dan.page.keyboard.press('Escape')
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true)
    })
    await check('TC14: offline keeps data, shows last update, retry recovers', async () => {
      const page = dan.page
      await dan.context.setOffline(true)
      await page.getByRole('alert').filter({ hasText: 'Chưa đồng bộ' }).waitFor({ timeout: 20000 })
      await page.getByRole('article').filter({ hasText: `Yêu cầu #${requestId}` }).waitFor()
      await screenshot(page, 'desktop-offline')
      await dan.context.setOffline(false)
      await page.getByRole('button', { name: 'Thử lại' }).click()
      await page.getByRole('alert').filter({ hasText: 'Chưa đồng bộ' }).waitFor({ state: 'detached' })
    })
    await check('TC16/18: refresh restores session; wrong route denied', async () => {
      await dan.page.reload()
      await dan.page.getByRole('heading', { name: 'Tổng quan yêu cầu' }).waitFor()
      await dan.page.goto(env.base + '/admin')
      await dan.page.getByRole('heading', { name: 'Không có quyền truy cập' }).waitFor()
      await dan.page.getByRole('link', { name: 'Về trang của tôi' }).click()
      await dan.page.waitForURL('**/dan')
    })
    await check('F10: controlled visibilitychange stops and resumes polling', async () => {
      const page = dan.page
      await page.getByRole('article').first().waitFor()
      let count = 0
      page.on('request', r => { if (r.method() === 'GET' && new URL(r.url()).pathname === '/api/requests/mine') count++ })
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
        document.dispatchEvent(new Event('visibilitychange'))
      })
      const before = count
      await new Promise(resolve => setTimeout(resolve, 6000))
      assert.equal(count, before)
      await page.evaluate(() => {
        delete document.hidden
        document.dispatchEvent(new Event('visibilitychange'))
      })
      await page.waitForResponse(r => new URL(r.url()).pathname === '/api/requests/mine')
      assert.ok(count > before)
    })
    await check('TC20/M05: pagination, real charts, status filter on desktop', async () => {
      const d = await env.login('D01')
      for (let i = 0; i < 22; i++) assert.equal((await env.api('/api/requests', { method: 'POST', cookie: d.cookie, body: requestBody() })).status, 201)
      await admin.page.reload()
      await admin.page.getByRole('heading', { name: 'Phân bố trạng thái' }).waitFor()
      await admin.page.getByRole('button', { name: 'Trang sau' }).click()
      await admin.page.getByText('Trang 2 / 2', { exact: true }).waitFor()
      await admin.page.getByLabel('Trạng thái', { exact: true }).selectOption('HOAN_THANH')
      await admin.page.locator('tbody tr').first().waitFor()
      assert.equal(await admin.page.locator('tbody tr').count(), 1)
      await admin.page.getByRole('button', { name: '14 ngày', exact: true }).click()
      await screenshot(admin.page, 'desktop-admin')
    })
    await check('M01–M06 mobile 390x844: no horizontal overflow, form and detail', async () => {
      for (const [name, page] of [['dan', dan.page], ['thugom', tg1.page], ['admin', admin.page]]) {
        await page.setViewportSize({ width: 390, height: 844 })
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflows`)
        await screenshot(page, 'mobile-' + name)
      }
      await dan.page.getByRole('link', { name: 'Tạo yêu cầu thu gom' }).click()
      await screenshot(dan.page, 'mobile-form')
      assert.ok(await dan.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await dan.page.getByRole('link', { name: 'Về trang người dân' }).click()
      await dan.page.getByRole('button', { name: 'Xem chi tiết' }).first().click()
      await dan.page.getByRole('dialog').locator('time').first().waitFor()
      await screenshot(dan.page, 'mobile-detail')
      await dan.page.getByRole('button', { name: 'Đóng chi tiết' }).click()
    })
    await check('TC15/UI: expired-session logout exits; logout stops polling', async () => {
      await env.db.prepare('UPDATE Sessions SET RevokedAt = ? WHERE UserId = ?').bind(new Date().toISOString(), tg2 ? (await env.db.prepare("SELECT UserId FROM Users WHERE Username = 'TG02'").first()).UserId : -1).run()
      await tg2.page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
      await tg2.page.waitForURL('**/login')
      let businessGets = 0
      dan.page.on('request', request => { if (request.method() === 'GET' && /\/api\/(requests|admin)\//.test(request.url())) businessGets++ })
      await dan.page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
      await dan.page.waitForURL('**/login')
      const afterLogout = businessGets
      await new Promise(resolve => setTimeout(resolve, 6000))
      assert.equal(businessGets, afterLogout)
      await screenshot(dan.page, 'mobile-login')
    })
    await check('F10/401: revoked session polling redirects to login', async () => {
      const user = await env.db.prepare("SELECT UserId FROM Users WHERE Username = 'AD01'").first()
      await env.db.prepare('UPDATE Sessions SET RevokedAt = ? WHERE UserId = ?').bind(new Date().toISOString(), user.UserId).run()
      await admin.page.waitForURL('**/login', { timeout: 15000 })
      assert.equal(await admin.page.getByRole('heading', { name: 'Tổng quan thu gom' }).count(), 0)
    })
    await check('Browser JavaScript: no uncaught application errors', async () => assert.deepEqual(errors, []))
  } finally {
    await writeFile(evidence + 'browser.json', JSON.stringify({ ...metadata(), browser: await browser.version(),
      viewports: ['1366x900', '390x844'], results, uncaughtErrors: errors }, null, 2) + '\n')
    await browser.close(); await env.close()
  }
  if (results.some(r => r.status === 'FAIL')) process.exitCode = 1
}

if (process.argv[1] && new URL(import.meta.url).pathname.toLowerCase().endsWith(process.argv[1].replaceAll('\\', '/').split('/').pop().toLowerCase())) {
  await runBrowserSuite()
}
