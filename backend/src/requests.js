import { AREA_OPTIONS, REQUEST_STATUSES, WASTE_TYPES, vietnamDate } from '../../shared/request-options.mjs'

const areas = AREA_OPTIONS.map(({ value }) => value)
const roles = {
  'GET /api/requests/mine': 'DAN',
  'POST /api/requests': 'DAN',
  'GET /api/requests/available': 'THUGOM',
  'GET /api/requests/assigned': 'THUGOM',
  'GET /api/admin/requests': 'ADMIN',
  'GET /api/admin/stats': 'ADMIN',
}

const fields = `
  r.RequestId, r.UserId, r.CollectorId, r.WasteType, r.QuantityKg,
  r.Address, r.Area, r.PreferredDate, r.Note, r.Status,
  r.CreatedAt, r.AcceptedAt, r.CompletedAt, collector.FullName AS CollectorName
`
const fromRequests = 'FROM Requests r LEFT JOIN Users collector ON collector.UserId = r.CollectorId'

class RequestError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function badInput(message) {
  return new RequestError(400, 'INVALID_INPUT', message)
}

function unavailable() {
  return new RequestError(404, 'REQUEST_NOT_FOUND', 'Không tìm thấy yêu cầu.')
}

function forbidden() {
  return new RequestError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.')
}

function conflict() {
  return new RequestError(409, 'REQUEST_NOT_AVAILABLE', 'Yêu cầu đã được tiếp nhận hoặc không còn ở trạng thái phù hợp.')
}

function success(data, status = 200) {
  return Response.json({ success: true, data }, { status, headers: { 'Cache-Control': 'no-store' } })
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().startsWith(value + 'T')
}

function publicRequest(row, user) {
  const result = {
    requestId: row.RequestId,
    wasteType: row.WasteType,
    quantityKg: row.QuantityKg,
    area: row.Area,
    preferredDate: row.PreferredDate,
    status: row.Status,
    createdAt: row.CreatedAt,
    acceptedAt: row.AcceptedAt,
    completedAt: row.CompletedAt,
  }

  const pendingForCollector = user.Role === 'THUGOM' && row.Status === 'CHO_NHAN'
  if (!pendingForCollector) {
    result.address = row.Address
    result.note = row.Note
    result.collectorId = row.CollectorId
    result.collectorName = row.CollectorName ?? null
  }
  if (user.Role === 'ADMIN') result.userId = row.UserId
  return result
}

function positiveInteger(value) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : null
}

function pagination(params) {
  const page = positiveInteger(params.get('page') ?? '1')
  const limit = positiveInteger(params.get('limit') ?? '20')
  if (!page || !limit || limit > 50 || !Number.isSafeInteger((page - 1) * limit)) {
    throw badInput('Trang phải là số nguyên dương và mỗi trang chỉ được có tối đa 50 yêu cầu.')
  }
  return { page, limit }
}

function filterValue(params, key, options) {
  const value = params.get(key)
  if (value && !options.includes(value)) throw badInput('Giá trị bộ lọc không hợp lệ.')
  return value
}

function adminDates(params, add) {
  const start = params.get('from')
  const end = params.get('to')
  if ((start && !validDate(start)) || (end && !validDate(end)) || (start && end && start > end)) {
    throw badInput('Khoảng ngày tạo không hợp lệ.')
  }
  if (start) add('r.CreatedAt >= ?', new Date(start + 'T00:00:00+07:00').toISOString())
  if (end) add('r.CreatedAt <= ?', new Date(end + 'T23:59:59.999+07:00').toISOString())
}

async function listRequests(db, user, params, path) {
  const { page, limit } = pagination(params)
  const filters = []
  const values = []
  function add(filter, value) {
    filters.push(filter)
    values.push(value)
  }

  if (path.endsWith('/mine')) add('r.UserId = ?', user.UserId)
  if (path.endsWith('/assigned')) add('r.CollectorId = ?', user.UserId)
  if (path.endsWith('/available')) {
    add('r.Status = ?', 'CHO_NHAN')
    const area = filterValue(params, 'area', areas)
    if (area) add('r.Area = ?', area)
  }
  if (path.endsWith('/available') || user.Role === 'ADMIN') {
    const wasteType = filterValue(params, 'wasteType', WASTE_TYPES)
    if (wasteType) add('r.WasteType = ?', wasteType)
  }
  if (user.Role === 'ADMIN') {
    const status = filterValue(params, 'status', REQUEST_STATUSES)
    if (status) add('r.Status = ?', status)
    adminDates(params, add)
  }

  const where = filters.length ? 'WHERE ' + filters.join(' AND ') : ''
  const [count, rows] = await db.batch([
    db.prepare(`SELECT COUNT(*) AS total FROM Requests r ${where}`).bind(...values),
    db.prepare(`SELECT ${fields} ${fromRequests} ${where}
      ORDER BY r.CreatedAt DESC, r.RequestId DESC LIMIT ? OFFSET ?`).bind(...values, limit, (page - 1) * limit),
  ])
  return success({
    items: rows.results.map(row => publicRequest(row, user)),
    pagination: { page, limit, total: count.results[0].total },
  })
}

async function createRequest(request, db, user) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badInput('JSON không hợp lệ.')
  const { wasteType, quantityKg, area, preferredDate, note = '' } = body
  const address = typeof body.address === 'string' ? body.address.trim() : ''
  const now = new Date()

  if (!WASTE_TYPES.includes(wasteType)) throw badInput('Loại rác không hợp lệ.')
  if (!Number.isFinite(quantityKg) || quantityKg <= 0 || quantityKg > 1000) {
    throw badInput('Khối lượng phải lớn hơn 0 và không vượt quá 1000 kg.')
  }
  if (address.length < 5 || address.length > 200) throw badInput('Địa chỉ phải có từ 5 đến 200 ký tự.')
  if (!areas.includes(area)) throw badInput('Khu vực thu gom không hợp lệ.')
  if (!validDate(preferredDate) || preferredDate < vietnamDate(now)) {
    throw badInput('Ngày mong muốn phải hợp lệ và từ hôm nay trở đi.')
  }
  if (typeof note !== 'string' || note.length > 500) throw badInput('Ghi chú tối đa 500 ký tự.')

  const timestamp = now.toISOString()
  const [insert] = await db.batch([
    db.prepare(`INSERT INTO Requests
      (UserId, WasteType, QuantityKg, Address, Area, PreferredDate, Note, CreatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING RequestId AS requestId, Status AS status`)
      .bind(user.UserId, wasteType, quantityKg, address, area, preferredDate, note.trim() || null, timestamp),
    db.prepare(`INSERT INTO RequestLogs (RequestId, ActorId, Action, CreatedAt)
      VALUES (last_insert_rowid(), ?, 'CREATE', ?)`).bind(user.UserId, timestamp),
  ])
  return success(insert.results[0], 201)
}

async function requestDetail(db, user, id) {
  const row = await db.prepare(`SELECT ${fields} ${fromRequests} WHERE r.RequestId = ?`).bind(id).first()
  if (!row) throw unavailable()
  if (user.Role === 'DAN' && row.UserId !== user.UserId) throw unavailable()
  if (user.Role === 'THUGOM' && row.Status !== 'CHO_NHAN' && row.CollectorId !== user.UserId) throw unavailable()
  if (!['DAN', 'THUGOM', 'ADMIN'].includes(user.Role)) throw forbidden()
  return success(publicRequest(row, user))
}

async function transition(db, user, id, action) {
  const accepting = action === 'accept'
  const timestamp = new Date().toISOString()
  const update = accepting
    ? db.prepare(`UPDATE Requests SET Status = 'DA_NHAN', CollectorId = ?, AcceptedAt = ?
        WHERE RequestId = ? AND Status = 'CHO_NHAN' AND CollectorId IS NULL
        RETURNING RequestId AS requestId, Status AS status, AcceptedAt AS acceptedAt`)
      .bind(user.UserId, timestamp, id)
    : db.prepare(`UPDATE Requests SET Status = 'HOAN_THANH', CompletedAt = ?
        WHERE RequestId = ? AND Status = 'DA_NHAN' AND CollectorId = ?
        RETURNING RequestId AS requestId, Status AS status, CompletedAt AS completedAt`)
      .bind(timestamp, id, user.UserId)

  // D1 executes the batch transaction on one connection. changes() reads
  // the immediately preceding UPDATE and suppresses logs for losing writers.
  const [result] = await db.batch([
    update,
    db.prepare(`INSERT INTO RequestLogs (RequestId, ActorId, Action, CreatedAt)
      SELECT ?, ?, ?, ? WHERE changes() = 1`)
      .bind(id, user.UserId, accepting ? 'ACCEPT' : 'COMPLETE', timestamp),
  ])

  if (result.results.length === 1) return success(result.results[0])
  if (!accepting) {
    const row = await db.prepare('SELECT CollectorId FROM Requests WHERE RequestId = ?').bind(id).first()
    if (!row) throw unavailable()
    if (row.CollectorId !== null && row.CollectorId !== user.UserId) throw forbidden()
  }
  throw conflict()
}

async function stats(db) {
  const { results } = await db.prepare(
    'SELECT Status, WasteType, COUNT(*) AS count FROM Requests GROUP BY Status, WasteType'
  ).all()
  const byStatus = Object.fromEntries(REQUEST_STATUSES.map(status => [status, 0]))
  const wasteCounts = Object.fromEntries(WASTE_TYPES.map(wasteType => [wasteType, 0]))
  let total = 0
  for (const { Status, WasteType, count } of results) {
    byStatus[Status] += count
    wasteCounts[WasteType] += count
    total += count
  }
  const byWasteType = Object.entries(wasteCounts).map(([wasteType, count]) => ({ wasteType, count }))
  return success({ total, byStatus, byWasteType })
}

export async function handleRequests(request, url, env, getUser) {
  const path = url.pathname
  const method = request.method
  const key = method + ' ' + path
  const route = path.match(/^\/api\/requests\/(\d+)(?:\/(accept|complete))?$/)
  const role = roles[key]
  const action = route?.[2]
  const detail = route && !action && method === 'GET'
  const mutation = route && action && method === 'POST'
  if (!role && !detail && !mutation) return null

  try {
    const user = await getUser(request, env)
    if (!user) throw new RequestError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.')
    if ((role && user.Role !== role) || (mutation && user.Role !== 'THUGOM')) throw forbidden()
    const { DB: db } = env
    if (route) {
      const id = positiveInteger(route[1])
      if (!id) throw badInput('Mã yêu cầu không hợp lệ.')
      if (mutation) return await transition(db, user, id, action)
      return await requestDetail(db, user, id)
    }
    if (method === 'POST') return await createRequest(request, db, user)
    if (path === '/api/admin/stats') return await stats(db)
    return await listRequests(db, user, url.searchParams, path)
  } catch (error) {
    if (!(error instanceof RequestError)) throw error
    return Response.json({
      success: false,
      error: { code: error.code, message: error.message },
    }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
  }
}
