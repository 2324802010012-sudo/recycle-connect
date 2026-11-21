// Preserve existing hashes; changing this policy requires a migration plan.
export const PASSWORD_ITERATIONS = 310000
export const PASSWORD_BYTES = 32
export const PASSWORD_SCHEME = 'pbkdf2_sha256'

export function parsePasswordHash(stored) {
  if (typeof stored !== 'string') return null
  const [scheme, rounds, salt, digest, extra] = stored.split('$')
  if (extra !== undefined || scheme !== PASSWORD_SCHEME || rounds !== String(PASSWORD_ITERATIONS)
    || !/^[0-9a-f]{64}$/.test(salt ?? '') || !/^[0-9a-f]{64}$/.test(digest ?? '')) return null
  return { salt, digest }
}
