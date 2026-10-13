// Studio logic tests: bundles each tests/studio/*.test.ts with rolldown (already installed with
// Vite) and runs them with Node's built-in test runner.   npm run test:studio
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const src = join(root, 'tests/studio')
const out = join(root, '.test-build')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
const files = readdirSync(src).filter((f) => f.endsWith('.test.ts'))
for (const f of files) {
  const r = spawnSync('npx', ['rolldown', join(src, f), '--format', 'esm', '--platform', 'node', '--dir', join(out, f.replace(/\.test\.ts$/, ''))], { cwd: root, stdio: ['ignore', 'ignore', 'inherit'] })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
// package.json says "type": "module", so the bundled .js entries load as ES modules
const t = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files.map((f) => join(out, f.replace(/\.test\.ts$/, ''), f.replace(/\.ts$/, '.js')))], { cwd: root, stdio: 'inherit' })
process.exit(t.status ?? 1)
