// node --test tests/server/auth.test.mjs
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createAuth } from '../../server/realtime/auth.mjs'

const DAY = 864e5
const adult = '1990-05-01'
const minor = () => new Date(Date.now() - 17 * 365.25 * DAY).toISOString().slice(0, 10)
const fails = async (p) => {
  try {
    await p
  } catch (e) {
    return e
  }
  assert.fail('expected an error')
}

test('accounts: sign up, sign in, 30-day refresh that rotates, sign out, unique names, 18+', async () => {
  const file = join(mkdtempSync(join(tmpdir(), 'ds-auth-')), 'accounts.json')
  let now = Date.now()
  const a = createAuth({ file, now: () => now })

  const r = await a.register({ username: 'Bibi Star', password: 'matcha1234', dob: adult })
  assert.ok(r.access && r.refresh)
  assert.equal(r.refreshExp - now, 30 * DAY, 'refresh token lasts 30 days')

  let e = await fails(a.register({ username: 'bibi-star', password: 'matcha1234', dob: adult }))
  assert.equal(e.code, 'username_taken')
  assert.equal(e.text, 'That username is already taken.')
  assert.equal((await fails(a.register({ username: 'Kiddo', password: 'matcha1234', dob: minor() }))).code, 'under_age')
  assert.equal((await fails(a.register({ username: 'Shorty', password: 'abc', dob: adult }))).code, 'weak_password')
  assert.equal((await fails(a.login({ username: 'Bibi Star', password: 'wrong-pass' }))).code, 'wrong_password')
  assert.equal((await fails(a.login({ username: 'Nobody', password: 'whatever1' }))).code, 'no_account')

  const l = await a.login({ username: 'BIBI STAR', password: 'matcha1234' })
  await a.putLook(l.access, { hello: 1 })
  assert.equal((await a.getLook(l.access)).look.hello, 1, 'the doll is saved to the account')

  now += 29 * DAY
  const r2 = await a.refresh({ refresh: l.refresh })
  assert.ok(r2.access, 'still signed in on day 29')
  assert.equal((await fails(a.refresh({ refresh: l.refresh }))).code, 'signed_out', 'refresh tokens are single use')
  now += 31 * DAY
  assert.equal((await fails(a.refresh({ refresh: r2.refresh }))).code, 'signed_out', 'and expire after 30 days')
  assert.equal((await fails(a.getLook(r2.access))).code, 'expired')

  const l2 = await a.login({ username: 'Bibi Star', password: 'matcha1234' })
  await a.logout({ refresh: l2.refresh })
  assert.equal((await fails(a.refresh({ refresh: l2.refresh }))).code, 'signed_out', 'signing out ends the session')

  await new Promise((res) => setTimeout(res, 400))
  const b = createAuth({ file })
  assert.equal((await fails(b.register({ username: 'Bibi Star', password: 'x1234567', dob: adult }))).code, 'username_taken', 'accounts persist')
})
