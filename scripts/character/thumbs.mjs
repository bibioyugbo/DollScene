// node scripts/character/thumbs.mjs [starters|pieces|outfits|shoes|hair]: renders the picker and store tile
// thumbnails from the running game (npx vite --config vite.studio.config.ts --port 5190). ONLY=id,id limits it.
// Needs Chrome and puppeteer-core (npm i -D puppeteer-core).
import puppeteer from 'puppeteer-core'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
const ROOT = new URL('../../public/thumbs', import.meta.url).pathname
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-thumbs-'))
fs.mkdirSync(TMP, { recursive: true })
const kinds = process.argv.slice(2).length ? process.argv.slice(2) : ['starters', 'outfits', 'shoes', 'hair']
const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] })
const p = await b.newPage()
const logs = []
p.on('pageerror', (e) => logs.push('pageerror ' + e.message))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await p.setViewport({ width: 720, height: 900 })
await p.goto('http://localhost:5190/?shot&hideui', { waitUntil: 'domcontentloaded' })
await p.waitForFunction('window.__dsShotReady === true', { timeout: 300000 })
await p.evaluate(() => window.__dsStudio.setState({ phase: 'onboard', uiHidden: true }))
const cat = await p.evaluate(() => fetch('/models/studio/character.json').then((r) => r.json()))
const mannequin = await p.evaluate(() => { const c = structuredClone(window.__dsPresets.find((x) => x.id === 'priya').look); c.jewellery = { ...c.jewellery, glasses: 'none', nose: 'none' }; return c })
async function shot(look, framing, out, crop, angle = 'front') {
  await p.evaluate((look, framing, angle) => { const s = window.__dsStudio; s.getState().replace(look); s.getState().setFraming(framing); s.getState().setAngle(angle) }, look, framing, angle)
  await sleep(1600)
  const file = `${TMP}/${out.replace('/', '_')}.png`
  await p.screenshot({ path: file, clip: crop })
  fs.mkdirSync(`${ROOT}/${out.split('/')[0]}`, { recursive: true })
  execFileSync('python3', ['-c', `from PIL import Image; im=Image.open('${file}').convert('RGB'); im.resize((256,256), Image.LANCZOS).save('${ROOT}/${out}.webp', 'WEBP', quality=86)`])
}
const square = (cx, cy, s) => ({ x: Math.round(cx - s / 2), y: Math.round(cy - s / 2), width: s, height: s })
if (kinds.includes('starters')) {
  const presets = await p.evaluate(() => window.__dsPresets.map((c) => c.id))
  for (const id of (process.env.ONLY ? process.env.ONLY.split(',') : presets)) {
    const look = await p.evaluate((id) => window.__dsPresets.find((x) => x.id === id).look, id)
    await shot(look, 'bust', `starters/${id}`, square(360, 330, 470))
  }
}
const BASIC = { top: { id: 'top_tank', colors: ['#F4EFE6', '#2A2A2A', '#2A2A2A'] }, bottom: { id: 'bottom_skinny_jeans', colors: ['#2E3D5C', '#D8A04A', '#B8B8B8'] }, dress: null, shoes: { id: 'shoes03', colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] } }
const only = process.env.ONLY ? process.env.ONLY.split(',') : null
if (kinds.includes('outfits')) {
  for (const o of cat.outfits) {
    if (only && !only.includes(o.id)) continue
    const look = { ...mannequin, wear: { ...BASIC, top: null, bottom: null, dress: { id: o.id, colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] } }, hair: { ...mannequin.hair, style: 'bun' } }
    await shot(look, 'full', `outfits/${o.id}`, square(360, 400, 500))
  }
}
if (kinds.includes('shoes')) {
  for (const s of cat.shoes) {
    if (only && !only.includes(s.id)) continue
    const look = { ...mannequin, wear: { ...BASIC, bottom: { id: 'bottom_mini_skirt', colors: ['#2E3D5C', '#2E3D5C', '#2E3D5C'] }, shoes: { id: s.id, colors: ['#FFFFFF', '#FFFFFF', '#FFFFFF'] } } }
    await shot(look, 'full', `shoes/${s.id}`, square(360, 790, 170), 'three-quarter')
  }
}
if (kinds.includes('pieces')) {
  for (const pc of cat.pieces ?? []) {
    if (only && !only.includes(pc.id)) continue
    const wear = { ...BASIC, [pc.slot]: { id: pc.id, colors: pc.colors } }
    if (pc.slot === 'dress') wear.top = wear.bottom = null
    if (pc.slot === 'bottom') wear.top = { id: 'top_crop_tank', colors: ['#F4EFE6', '#F4EFE6', '#F4EFE6'] }
    const look = { ...mannequin, wear, hair: { ...mannequin.hair, style: 'bun' } }
    if (pc.slot === 'shoes') {
      wear.bottom = { id: 'bottom_mini_skirt', colors: ['#2E3D5C', '#2E3D5C', '#2E3D5C'] }
      await shot(look, 'full', `pieces/${pc.id}`, square(360, 770, 190), 'three-quarter')
    } else if (pc.slot === 'top') await shot(look, 'bust', `pieces/${pc.id}`, square(360, 420, 560))
    else if (pc.slot === 'bottom') await shot({ ...look }, 'full', `pieces/${pc.id}`, square(360, 560, 420))
    else await shot(look, 'full', `pieces/${pc.id}`, square(360, 400, 500))
  }
}
if (kinds.includes('hair')) {
  for (const h of cat.hair) {
    if (h.id === 'bonnet') continue
    const look = { ...mannequin, hair: { ...mannequin.hair, style: h.id, color: '#2A1A12', tip: '#2A1A12', blend: 0 } }
    await shot(look, 'hair', `hair/${h.id}`, square(360, 400, 720), 'three-quarter')
  }
}
console.log(logs.join('\n') || 'ok')
await b.close()
