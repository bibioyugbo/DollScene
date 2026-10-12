import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'
import { tattooCanvas } from '../data/tattoos'
import type { FloorMaterial, HairLook, Pattern, Wallpaper } from '../shared/types'

const cache = new Map<string, Texture>()

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function finish(c: HTMLCanvasElement, repeat = 1): Texture {
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.anisotropy = 4
  return t
}

function cached(key: string, make: () => Texture): Texture {
  let t = cache.get(key)
  if (!t) cache.set(key, (t = make()))
  return t
}

/** Tileable textile textures for garments: ankara, adire, aso-oke, kente and friends. */
export function patternTexture(pattern: Pattern, c1: string, c2: string): Texture | null {
  if (pattern === 'solid') return null
  return cached(`p|${pattern}|${c1}|${c2}`, () => {
    const s = 128
    const [c, g] = canvas(s, s)
    g.fillStyle = c1
    g.fillRect(0, 0, s, s)
    g.fillStyle = c2
    g.strokeStyle = c2
    switch (pattern) {
      case 'ankara':
        for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96]]) {
          g.beginPath()
          g.arc(x, y, 22, 0, 7)
          g.fill()
          g.fillStyle = c1
          g.beginPath()
          g.arc(x, y, 11, 0, 7)
          g.fill()
          g.fillStyle = c2
          g.beginPath()
          g.arc(x, y, 5, 0, 7)
          g.fill()
        }
        g.fillStyle = '#FFC24D'
        for (const [x, y] of [[64, 64], [0, 64], [64, 0]]) {
          g.beginPath()
          g.arc(x, y, 6, 0, 7)
          g.fill()
        }
        break
      case 'adire':
        g.lineWidth = 3
        g.setLineDash([6, 4])
        for (let y = 8; y < s; y += 22) {
          g.beginPath()
          g.moveTo(0, y)
          g.lineTo(s, y)
          g.stroke()
        }
        g.setLineDash([])
        for (let x = 16; x < s; x += 32) for (let y = 19; y < s; y += 22) g.fillRect(x - 3, y - 3, 6, 6)
        break
      case 'aso-oke':
        for (let x = 0; x < s; x += 16) g.fillRect(x, 0, x % 32 ? 2 : 6, s)
        g.globalAlpha = 0.35
        for (let y = 0; y < s; y += 4) g.fillRect(0, y, s, 1)
        g.globalAlpha = 1
        break
      case 'kente':
        for (let x = 0; x < 4; x++)
          for (let y = 0; y < 4; y++) {
            g.fillStyle = (x + y) % 2 ? c2 : c1
            g.fillRect(x * 32, y * 32, 32, 32)
            g.fillStyle = '#1E0B26'
            g.fillRect(x * 32, y * 32 + 14, 32, 4)
            g.fillStyle = '#00A88F'
            g.fillRect(x * 32 + 14, y * 32, 4, 32)
          }
        break
      case 'denim':
        g.globalAlpha = 0.25
        g.lineWidth = 2
        for (let i = -s; i < s; i += 6) {
          g.beginPath()
          g.moveTo(i, s)
          g.lineTo(i + s, 0)
          g.stroke()
        }
        g.globalAlpha = 1
        break
      case 'leopard':
        g.fillStyle = '#2B1A10'
        for (const [x, y] of [[20, 24], [80, 18], [50, 70], [110, 80], [20, 100], [86, 118]]) {
          g.beginPath()
          g.ellipse(x, y, 10, 7, 0.5, 0, 7)
          g.lineWidth = 5
          g.strokeStyle = '#2B1A10'
          g.stroke()
        }
        break
      case 'check':
        g.globalAlpha = 0.45
        for (let i = 0; i < s; i += 32) {
          g.fillRect(i, 0, 16, s)
          g.fillRect(0, i, s, 16)
        }
        g.globalAlpha = 1
        break
      case 'stripe':
        for (let i = 0; i < s; i += 24) g.fillRect(i, 0, 10, s)
        break
      case 'floral':
        for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96]]) {
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2
            g.beginPath()
            g.arc(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 0, 7)
            g.fill()
          }
          g.fillStyle = '#FFC24D'
          g.beginPath()
          g.arc(x, y, 5, 0, 7)
          g.fill()
          g.fillStyle = c2
        }
        break
      case 'monogram':
        g.font = 'bold 36px Georgia, serif'
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.globalAlpha = 0.7
        for (const [x, y] of [[32, 32], [96, 96]]) g.fillText('D', x, y)
        for (const [x, y] of [[96, 32], [32, 96]]) g.fillText('C', x, y)
        g.globalAlpha = 1
        break
      case 'sequin':
        for (let x = 4; x < s; x += 8)
          for (let y = 4; y < s; y += 8) {
            g.fillStyle = (x + y) % 16 ? 'rgba(255,255,255,0.55)' : c2
            g.beginPath()
            g.arc(x, y, 3, 0, 7)
            g.fill()
          }
        break
      case 'lace':
        g.lineWidth = 2
        for (const [x, y] of [[32, 32], [96, 96], [96, 32], [32, 96], [64, 64]]) {
          g.beginPath()
          g.arc(x, y, 16, 0, 7)
          g.stroke()
          g.beginPath()
          g.arc(x, y, 6, 0, 7)
          g.stroke()
        }
        break
    }
    return finish(c, 2)
  })
}

/** Vertical hair texture: canvas top = roots, bottom = ends. Encodes every dye mode. */
export function hairTexture(h: Pick<HairLook, 'color' | 'dye'>): Texture {
  const { mode, color2 } = h.dye
  return cached(`h|${h.color}|${mode}|${color2}`, () => {
    const W = 128
    const H = 256
    const [c, g] = canvas(W, H)
    const grad = (stops: [number, string][]) => {
      const gr = g.createLinearGradient(0, 0, 0, H)
      for (const [o, col] of stops) gr.addColorStop(o, col)
      g.fillStyle = gr
      g.fillRect(0, 0, W, H)
    }
    switch (mode) {
      case 'ombre':
        grad([[0, h.color], [0.35, h.color], [1, color2]])
        break
      case 'root-shadow':
        grad([[0, h.color], [0.18, h.color], [0.3, color2], [1, color2]])
        break
      case 'gradient-ends':
        grad([[0, h.color], [0.6, h.color], [1, color2]])
        break
      case 'bleached-tips':
        grad([[0, h.color], [0.8, h.color], [0.84, color2], [1, color2]])
        break
      case 'split':
        g.fillStyle = h.color
        g.fillRect(0, 0, W / 2, H)
        g.fillStyle = color2
        g.fillRect(W / 2, 0, W / 2, H)
        break
      default:
        g.fillStyle = h.color
        g.fillRect(0, 0, W, H)
    }
    if (mode === 'highlights' || mode === 'balayage' || mode === 'peekaboo') {
      g.fillStyle = color2
      for (let x = 0; x < W; x += mode === 'highlights' ? 10 : 22) {
        const w = mode === 'highlights' ? 3 : 8
        if (mode === 'peekaboo' && (x < W * 0.25 || x > W * 0.5)) continue
        const gr = g.createLinearGradient(0, 0, 0, H)
        gr.addColorStop(0, 'rgba(0,0,0,0)')
        gr.addColorStop(mode === 'balayage' ? 0.45 : mode === 'peekaboo' ? 0.35 : 0.05, color2)
        gr.addColorStop(1, color2)
        g.fillStyle = gr
        g.fillRect(x, 0, w, H)
      }
    }
    // Strand texture.
    g.globalAlpha = 0.14
    for (let i = 0; i < 160; i++) {
      g.fillStyle = i % 2 ? '#000' : '#fff'
      g.fillRect(Math.random() * W, 0, 1, H)
    }
    g.globalAlpha = 1
    const t = finish(c)
    return t
  })
}

export function tattooTexture(design: string, color: string | null): Texture {
  return cached(`t|${design}|${color}`, () => {
    const t = new CanvasTexture(tattooCanvas(design, color))
    t.colorSpace = SRGBColorSpace
    return t
  })
}

export function wallpaperTexture(kind: Wallpaper, base: string): Texture | null {
  if (kind === 'none') return null
  if (kind === 'cheetah' || kind === 'girly' || kind === 'black') {
    const t = cached(`wp|${kind}`, () => {
      const [c, g] = canvas(256, 256)
      if (kind === 'cheetah') {
        g.fillStyle = '#D9A35B'
        g.fillRect(0, 0, 256, 256)
        for (let i = 0; i < 46; i++) {
          const x = (i * 97) % 256
          const y = (i * 61) % 256
          const r = 7 + (i % 4) * 2
          g.fillStyle = '#3B2219'
          g.beginPath()
          g.ellipse(x, y, r, r * 0.8, i, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#B07A3A'
          g.beginPath()
          g.ellipse(x, y, r * 0.5, r * 0.4, i, 0, Math.PI * 2)
          g.fill()
        }
      } else if (kind === 'girly') {
        g.fillStyle = '#FFD6E8'
        g.fillRect(0, 0, 256, 256)
        g.fillStyle = '#FFFFFF'
        for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 12, 256)
        for (let i = 0; i < 16; i++) {
          const x = 16 + (i % 4) * 64 + (Math.floor(i / 4) % 2) * 32
          const y = 24 + Math.floor(i / 4) * 64
          g.fillStyle = i % 2 ? '#FF8CC0' : '#E8187A'
          g.beginPath()
          g.moveTo(x, y + 8)
          g.bezierCurveTo(x - 14, y - 4, x - 6, y - 14, x, y - 6)
          g.bezierCurveTo(x + 6, y - 14, x + 14, y - 4, x, y + 8)
          g.fill()
        }
      } else {
        g.fillStyle = '#141218'
        g.fillRect(0, 0, 256, 256)
        g.fillStyle = 'rgba(255,255,255,0.05)'
        for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 2, 256)
      }
      const tex = new CanvasTexture(c)
      tex.colorSpace = SRGBColorSpace
      tex.wrapS = tex.wrapT = RepeatWrapping
      return tex
    }).clone()
    t.needsUpdate = true
    t.repeat.set(4, 2)
    return t
  }
  const pattern: Pattern = kind === 'ankara' ? 'ankara' : kind === 'adire' ? 'adire' : kind === 'stripe' ? 'stripe' : kind === 'floral' ? 'floral' : 'check'
  const accent = kind === 'adire' ? '#2B4BAA' : kind === 'ankara' ? '#FF6B2C' : '#FFFFFF'
  const t = patternTexture(pattern, base, accent)!.clone()
  t.needsUpdate = true
  t.repeat.set(4, 2)
  return t
}

export const FLOOR_COLORS: Record<FloorMaterial, string> = {
  concrete: '#B9B2AD',
  oak: '#C89B6D',
  walnut: '#6B4530',
  marble: '#EFEBE6',
  tile: '#E3E8EC',
  carpet: '#D9C2E8',
}

export function floorTexture(kind: FloorMaterial): Texture {
  return cached(`f|${kind}`, () => {
    const s = 256
    const [c, g] = canvas(s, s)
    g.fillStyle = FLOOR_COLORS[kind]
    g.fillRect(0, 0, s, s)
    if (kind === 'oak' || kind === 'walnut') {
      g.strokeStyle = 'rgba(0,0,0,0.18)'
      g.lineWidth = 2
      for (let y = 0; y < s; y += 32) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(s, y)
        g.stroke()
        const off = (y / 32) % 2 ? 64 : 0
        for (let x = off; x < s; x += 128) {
          g.beginPath()
          g.moveTo(x, y)
          g.lineTo(x, y + 32)
          g.stroke()
        }
      }
    } else if (kind === 'tile' || kind === 'marble') {
      g.strokeStyle = kind === 'tile' ? 'rgba(0,0,0,0.12)' : 'rgba(150,140,150,0.25)'
      g.lineWidth = kind === 'tile' ? 3 : 1
      for (let i = 0; i <= s; i += 64) {
        g.beginPath()
        g.moveTo(i, 0)
        g.lineTo(i, s)
        g.moveTo(0, i)
        g.lineTo(s, i)
        g.stroke()
      }
      if (kind === 'marble') {
        g.strokeStyle = 'rgba(120,110,130,0.25)'
        for (let k = 0; k < 6; k++) {
          g.beginPath()
          g.moveTo(Math.random() * s, 0)
          g.bezierCurveTo(Math.random() * s, s / 3, Math.random() * s, (2 * s) / 3, Math.random() * s, s)
          g.stroke()
        }
      }
    } else {
      g.globalAlpha = 0.08
      for (let i = 0; i < 2000; i++) {
        g.fillStyle = i % 2 ? '#000' : '#fff'
        g.fillRect(Math.random() * s, Math.random() * s, 2, 2)
      }
    }
    return finish(c, 3)
  })
}
