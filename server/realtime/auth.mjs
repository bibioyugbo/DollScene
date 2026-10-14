/**
 * DollScene accounts: username + password, short-lived access tokens and 30-day refresh tokens.
 *
 *   POST /auth/register  { username, password, dob }  -> { user, access, refresh, refreshExp }
 *   POST /auth/login     { username, password }       -> { user, access, refresh, refreshExp }
 *   POST /auth/refresh   { refresh }                  -> { user, access, refresh, refreshExp }  (rotates)
 *   POST /auth/logout    { refresh }                  -> { ok }                                 (revokes)
 *   GET  /auth/look      Authorization: Bearer <access> -> { look }
 *   PUT  /auth/look      Authorization: Bearer <access>, { look } -> { ok }
 *
 * Passwords: scrypt (N=16384, r=8, p=1) with a per-user salt; compared in constant time. Access
 * tokens: HMAC-SHA256 signed, 15 minutes. Refresh tokens: 32 random bytes, stored only as a
 * SHA-256 hash, valid 30 days, single use (each refresh issues a new one; reusing an old one
 * revokes all of that user's sessions). Usernames are the doll's name and unique regardless of case,
 * accents and punctuation. Date of birth is checked (18+) and never stored.
 *
 * Storage: a JSON file (ACCOUNTS_FILE, default .data/accounts.json). Point it at a persistent
 * volume in production (or swap `store` for a database).
 */
import { createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const ACCESS_MS = 15 * 60_000
export const REFRESH_MS = 30 * 24 * 60 * 60_000
const MIN_AGE = 18
const MAX_LOOK = 64 * 1024

export const nameKey = (n) => String(n || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 24)
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} '’._-]{1,23}$/u

const b64 = (b) => Buffer.from(b).toString('base64url')
const sha = (s) => createHash('sha256').update(s).digest('hex')
const scryptP = (pw, salt) => new Promise((res, rej) => scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))))

export class AuthError extends Error {
  constructor(status, code, text) {
    super(code)
    this.status = status
    this.code = code
    this.text = text
  }
}

export function ageOn(dob, today = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dob || ''))
  if (!m) return NaN
  const [y, mo, d] = [+m[1], +m[2], +m[3]]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return NaN
  let age = today.getFullYear() - y
  if (today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d)) age--
  return age
}

export function createAuth({ file = process.env.ACCOUNTS_FILE || '.data/accounts.json', secret = process.env.AUTH_SECRET || '', now = () => Date.now() } = {}) {
  const key = secret || b64(randomBytes(32))
  /** nameKey -> user */
  const users = new Map()
  /** refresh hash -> { key, exp } */
  const refreshes = new Map()
  const attempts = new Map()
  let loaded = null
  let saveTimer = null

  const load = () =>
    (loaded ??= readFile(file, 'utf8').then(
      (t) => {
        const d = JSON.parse(t)
        for (const u of d.users || []) users.set(u.key, u)
        for (const r of d.refreshes || []) if (r.exp > now()) refreshes.set(r.hash, { key: r.key, exp: r.exp })
      },
      () => {},
    ))
  const save = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      await mkdir(dirname(file), { recursive: true }).catch(() => {})
      const data = { users: [...users.values()], refreshes: [...refreshes].map(([hash, r]) => ({ hash, ...r })) }
      await writeFile(file, JSON.stringify(data)).catch((e) => console.error('accounts save', e))
    }, 200)
  }

  const sign = (payload) => {
    const body = b64(JSON.stringify(payload))
    return `${body}.${b64(createHmac('sha256', key).update(body).digest())}`
  }
  /** The user an access token belongs to (or null). */
  const verifyAccess = (token) => {
    const [body, sig] = String(token || '').split('.')
    if (!body || !sig) return null
    const want = createHmac('sha256', key).update(body).digest()
    const got = Buffer.from(sig, 'base64url')
    if (got.length !== want.length || !timingSafeEqual(got, want)) return null
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString())
      if (typeof p.exp !== 'number' || p.exp < now()) return null
      const u = users.get(p.k)
      return u && u.id === p.sub ? u : null
    } catch {
      return null
    }
  }

  const issue = (u) => {
    const refresh = b64(randomBytes(32))
    const refreshExp = now() + REFRESH_MS
    refreshes.set(sha(refresh), { key: u.key, exp: refreshExp })
    save()
    return { user: { id: u.id, username: u.username }, access: sign({ sub: u.id, k: u.key, exp: now() + ACCESS_MS }), refresh, refreshExp }
  }

  const limit = (who) => {
    const t = now()
    const list = (attempts.get(who) || []).filter((x) => t - x < 10 * 60_000)
    list.push(t)
    attempts.set(who, list)
    if (list.length > 10) throw new AuthError(429, 'too_many', 'Too many tries. Wait a few minutes, then try again.')
  }

  async function register({ username, password, dob }, ip = '') {
    await load()
    const name = String(username || '').trim()
    if (!NAME_RE.test(name)) throw new AuthError(400, 'bad_username', 'Usernames are 2–24 letters, numbers, spaces, dots, dashes or apostrophes.')
    if (typeof password !== 'string' || password.length < 8) throw new AuthError(400, 'weak_password', 'Passwords need at least 8 characters.')
    if (password.length > 200) throw new AuthError(400, 'weak_password', 'That password is too long.')
    const age = ageOn(dob)
    if (!Number.isFinite(age) || age > 120 || age < 0) throw new AuthError(400, 'bad_dob', 'Enter a real date of birth.')
    if (age < MIN_AGE) throw new AuthError(403, 'under_age', `DollScene is for players ${MIN_AGE} and over.`)
    limit(`reg:${ip}`)
    const k = nameKey(name)
    if (k.length < 2) throw new AuthError(400, 'bad_username', 'Usernames need at least 2 letters or numbers.')
    if (users.has(k)) throw new AuthError(409, 'username_taken', 'That username is already taken.')
    const salt = b64(randomBytes(16))
    const hash = (await scryptP(password, salt)).toString('base64url')
    const u = { id: `u_${b64(randomBytes(9))}`, key: k, username: name, salt, hash, createdAt: now(), look: null }
    users.set(k, u)
    return issue(u)
  }

  async function login({ username, password }, ip = '') {
    await load()
    const k = nameKey(username)
    limit(`login:${ip}:${k}`)
    const u = users.get(k)
    if (!u) throw new AuthError(404, 'no_account', 'We couldn’t find a doll with that username.')
    const hash = await scryptP(String(password || ''), u.salt)
    const want = Buffer.from(u.hash, 'base64url')
    if (want.length !== hash.length || !timingSafeEqual(hash, want)) throw new AuthError(401, 'wrong_password', 'That password isn’t right.')
    return issue(u)
  }

  async function refresh({ refresh: token }) {
    await load()
    const h = sha(String(token || ''))
    const r = refreshes.get(h)
    if (!r) throw new AuthError(401, 'signed_out', 'Your session has ended. Sign in again.')
    refreshes.delete(h)
    if (r.exp < now()) {
      save()
      throw new AuthError(401, 'signed_out', 'Your session has ended. Sign in again.')
    }
    const u = users.get(r.key)
    if (!u) throw new AuthError(401, 'signed_out', 'Your session has ended. Sign in again.')
    return issue(u)
  }

  async function logout({ refresh: token }) {
    await load()
    refreshes.delete(sha(String(token || '')))
    save()
    return { ok: true }
  }

  async function getLook(access) {
    await load()
    const u = verifyAccess(access)
    if (!u) throw new AuthError(401, 'expired', 'Please sign in again.')
    return { look: u.look }
  }

  async function putLook(access, look) {
    await load()
    const u = verifyAccess(access)
    if (!u) throw new AuthError(401, 'expired', 'Please sign in again.')
    if (!look || typeof look !== 'object' || JSON.stringify(look).length > MAX_LOOK) throw new AuthError(400, 'bad_look', 'That look couldn’t be saved.')
    u.look = look
    save()
    return { ok: true }
  }

  /** Is this doll name free (for the unique-name check before sign-up)? */
  async function nameFree(name) {
    await load()
    return !users.has(nameKey(name))
  }

  return { register, login, refresh, logout, getLook, putLook, verifyAccess, nameFree, ready: load }
}

/** HTTP glue: (req, res, path) for /auth/* routes. Returns true when it handled the request. */
export function authRoutes(auth) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' }
  const reply = (res, code, body) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors })
    res.end(JSON.stringify(body))
  }
  const readBody = (req) =>
    new Promise((resolve) => {
      let b = ''
      req.on('data', (d) => {
        b += d
        if (b.length > MAX_LOOK + 4096) req.destroy()
      })
      req.on('end', () => {
        try {
          resolve(b ? JSON.parse(b) : {})
        } catch {
          resolve({})
        }
      })
    })
  return async (req, res, path) => {
    if (!path.startsWith('/auth/')) return false
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors)
      res.end()
      return true
    }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim()
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    try {
      const body = req.method === 'GET' ? {} : await readBody(req)
      let out
      if (path === '/auth/register' && req.method === 'POST') out = await auth.register(body, ip)
      else if (path === '/auth/login' && req.method === 'POST') out = await auth.login(body, ip)
      else if (path === '/auth/refresh' && req.method === 'POST') out = await auth.refresh(body)
      else if (path === '/auth/logout' && req.method === 'POST') out = await auth.logout(body)
      else if (path === '/auth/look' && req.method === 'GET') out = await auth.getLook(bearer)
      else if (path === '/auth/look' && req.method === 'PUT') out = await auth.putLook(bearer, body.look)
      else if (path === '/auth/name' && req.method === 'POST') out = { free: await auth.nameFree(body.name) }
      else return reply(res, 404, { error: 'not_found' }), true
      reply(res, 200, out)
    } catch (e) {
      if (e instanceof AuthError) reply(res, e.status, { error: e.code, text: e.text })
      else {
        console.error('auth', e)
        reply(res, 500, { error: 'error', text: 'Something went wrong. Try again.' })
      }
    }
    return true
  }
}
