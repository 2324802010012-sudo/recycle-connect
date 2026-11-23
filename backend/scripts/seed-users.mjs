import { randomBytes } from 'node:crypto'

import {
  closeSync,
  openSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'

import { spawnSync } from 'node:child_process'

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { AREA_OPTIONS } from '../../shared/request-options.mjs'
import { createPasswordHash } from '../../shared/passwords.mjs'

const backend = fileURLToPath(new URL('../', import.meta.url))
const cli = join(backend, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

const accounts = [
  {
    username: 'D01',
    fullName: 'Trần Thị Diệu',
    role: 'DAN',
    serviceArea: null
  },
  {
    username: 'TG01',
    fullName: 'Nhân viên thu gom 01',
    role: 'THUGOM',
    serviceArea: AREA_OPTIONS[0].value
  },
  {
    username: 'TG02',
    fullName: 'Nhân viên thu gom 02',
    role: 'THUGOM',
    serviceArea: AREA_OPTIONS[1].value
  },
  {
    username: 'AD01',
    fullName: 'Quản trị viên',
    role: 'ADMIN',
    serviceArea: null
  }
]

function sqlValue(value) {
  if (value === null) return 'NULL'

  return "'" + String(value).replaceAll("'", "''") + "'"
}

const password = process.env.DEMO_PASSWORD
const args = process.argv.slice(2)
const remote = args.includes('--remote')
const username = args.filter(x => x !== '--remote')[0]?.toUpperCase()
const selectedAccounts = username ? accounts.filter(account => account.username === username) : accounts

if (args.filter(x => x !== '--remote').length > 1 || selectedAccounts.length === 0) {
  console.error('Cách dùng: node scripts/seed-users.mjs [D01|TG01|TG02|AD01] [--remote]')
  process.exit(1)
}

if (!password || password.length < 8 || password.length > 128) {
  console.error(
    'Vui lòng đặt DEMO_PASSWORD từ 8 đến 128 ký tự.'
  )
  process.exit(1)
}

if (remote && process.env.CONFIRM_REMOTE_SEED !== 'YES') {
  console.error('Dừng an toàn: đặt CONFIRM_REMOTE_SEED=YES để xác nhận ghi vào D1 remote.')
  process.exit(1)
}
let sql = ''

for (const account of selectedAccounts) {
  const passwordHash = await createPasswordHash(password)

  sql += `
INSERT INTO Users (
  Username,
  PasswordHash,
  FullName,
  Role,
  ServiceArea,
  CreatedAt
)
VALUES (
  ${sqlValue(account.username)},
  ${sqlValue(passwordHash)},
  ${sqlValue(account.fullName)},
  ${sqlValue(account.role)},
  ${sqlValue(account.serviceArea)},
  ${sqlValue(new Date().toISOString())}
)
ON CONFLICT DO UPDATE SET
  PasswordHash = excluded.PasswordHash,
  FullName = excluded.FullName,
  Role = excluded.Role,
  ServiceArea = excluded.ServiceArea;
`
}

const fixture = join(tmpdir(), 'recycle-users-' + randomBytes(16).toString('hex') + '.sql')
const file = openSync(fixture, 'wx', 0o600)
try {
  try {
    writeFileSync(file, sql, 'utf8')
  } finally {
    closeSync(file)
  }
  const result = spawnSync(process.execPath, [
    cli, 'd1', 'execute', 'DB', remote ? '--remote' : '--local', '--file', fixture,
  ], { cwd: backend, stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  unlinkSync(fixture)
}
