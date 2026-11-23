import { DurableObject } from 'cloudflare:workers'
import { pbkdf2 } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { createPasswordHash, verifyPassword } from '../../shared/passwords.mjs'

function derive(password, salt, iterations, bytes) {
  return pbkdf2(sha256, password, salt, { c: iterations, dkLen: bytes })
}

// Chỉ tính KDF trong RPC nội bộ; không lưu mật khẩu/hash vào storage hoặc log.
// Durable Object có ngân sách CPU riêng, không dùng trần PBKDF2 của WebCrypto.
export class PasswordService extends DurableObject {
  async createHash(password) {
    return createPasswordHash(password, derive)
  }

  async verify(password, stored) {
    return verifyPassword(password, stored, derive)
  }
}

async function callPasswordService(env, method, ...args) {
  try {
    const service = env.PASSWORD_SERVICE.getByName('pbkdf2-v1')
    return await service[method](...args)
  } catch (error) {
    console.error(JSON.stringify({ event: 'password_service_failed', errorName: error?.name || 'Error' }))
    const unavailable = new Error('Password service unavailable')
    unavailable.name = 'PasswordServiceError'
    throw unavailable
  }
}

export const hashPassword = (env, password) => callPasswordService(env, 'createHash', password)
export const checkPassword = (env, password, stored) => callPasswordService(env, 'verify', password, stored)
