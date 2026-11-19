
import {
  randomBytes,
  pbkdf2Sync
} from 'node:crypto'

import {
  writeFileSync
} from 'node:fs'

import {
  spawnSync
} from 'node:child_process'

const DATABASE = 'recycle-connect-db'

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
    serviceArea: 'KHU_VUC_1'
  },
  {
    username: 'AD01',
    fullName: 'Quản trị viên',
    role: 'ADMIN',
    serviceArea: null
  }
]

function hashPassword(password) {
  const salt = randomBytes(32).toString('hex')

  const hash = pbkdf2Sync(
    password,
    Buffer.from(salt, 'utf8'),
    310000,
    32,
    'sha256'
  ).toString('hex')

  return `pbkdf2_sha256$310000$${salt}$${hash}`
}

function sqlValue(value) {
  if (value === null) return 'NULL'

  return "'" + String(value).replaceAll("'", "''") + "'"
}

const password = process.env.DEMO_PASSWORD

if (!password || password.length < 8) {
  console.error(
    'Vui lòng đặt DEMO_PASSWORD tối thiểu 8 ký tự.'
  )
  process.exit(1)
}

let sql = ''

for (const account of accounts) {
  const passwordHash = hashPassword(password)

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
ON CONFLICT(Username) DO UPDATE SET
  PasswordHash = excluded.PasswordHash,
  FullName = excluded.FullName,
  Role = excluded.Role,
  ServiceArea = excluded.ServiceArea;
`
}

writeFileSync(
  'seed-users.sql',
  sql,
  { encoding: 'utf8', mode: 0o600 }
)

const result = spawnSync(
  'npx.cmd',
  [
    'wrangler',
    'd1',
    'execute',
    DATABASE,
    '--local',
    '--file=./seed-users.sql'
  ],
  {
    stdio: 'inherit',
    shell: true
  }
)

process.exit(result.status ?? 1)

