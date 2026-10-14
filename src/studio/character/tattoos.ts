import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace } from 'three'
import type { Tattoo, TattooDesign, TattooSpot } from '../../shared/studio/look'
import type { CareData } from './catalog'

/**
 * Tattoos are ink in the skin, not stickers: each design is drawn into a canvas laid out like the
 * body's UVs, at the spot the build measured (its UV, how many UV units a metre of skin is there,
 * and which way is "up" on the skin), and the skin shader mixes that ink under the makeup. Removal
 * at the Beauty Doctor fades a single tattoo's ink away (fx.tattoo.fade) before the look drops it.
 *
 * Designs are drawn in a 100 x 100 box, up = -y, line work in ink.
 */

const SIZE = 2048
/** A design's height on the skin at size 1 (metres). */
const BASE_M = 0.075

type Draw = (c: CanvasRenderingContext2D) => void

const stroke = (c: CanvasRenderingContext2D, w = 3.2) => {
  c.lineWidth = w
  c.lineCap = 'round'
  c.lineJoin = 'round'
  c.stroke()
}
const path = (c: CanvasRenderingContext2D, d: string, w = 3.2, fill = false) => {
  const p = new Path2D(d)
  c.lineWidth = w
  c.lineCap = 'round'
  c.lineJoin = 'round'
  if (fill) c.fill(p)
  c.stroke(p)
}

const DESIGNS: Record<TattooDesign, Draw> = {
  rose: (c) => {
    // a bloom of overlapping petals, two leaves and a thorned stem
    path(c, 'M50 30 C38 30 33 40 38 47 C43 54 57 54 62 47 C67 40 62 30 50 30 Z')
    path(c, 'M50 36 C44 36 42 42 46 45 C50 48 55 45 54 41 C53 38 50 38 49 40', 2.6)
    path(c, 'M36 40 C28 44 30 56 40 58 C47 60 50 56 50 56 C50 56 53 60 60 58 C70 56 72 44 64 40', 2.8)
    path(c, 'M50 58 C50 68 48 78 46 92', 3)
    path(c, 'M48 72 C40 66 32 68 28 72 C34 76 42 76 48 72 Z', 2.6, true)
    path(c, 'M47 82 C55 78 62 80 66 84 C60 88 52 87 47 82 Z', 2.6, true)
    path(c, 'M49 64 l4 -3 M47 77 l-4 -2', 2)
  },
  butterfly: (c) => {
    path(c, 'M50 34 L50 70', 4)
    path(c, 'M50 40 C40 18 14 20 18 38 C20 50 36 52 48 48 Z')
    path(c, 'M50 40 C60 18 86 20 82 38 C80 50 64 52 52 48 Z')
    path(c, 'M48 52 C36 54 24 66 32 76 C40 84 48 70 49 58 Z')
    path(c, 'M52 52 C64 54 76 66 68 76 C60 84 52 70 51 58 Z')
    path(c, 'M50 34 C46 26 42 22 38 20 M50 34 C54 26 58 22 62 20', 2.2)
    for (const [x, y] of [
      [28, 34],
      [72, 34],
      [38, 66],
      [62, 66],
    ]) {
      c.beginPath()
      c.arc(x, y, 3.2, 0, Math.PI * 2)
      c.fill()
    }
  },
  heart: (c) => {
    path(c, 'M50 82 C30 66 14 54 16 38 C18 24 36 20 50 36 C64 20 82 24 84 38 C86 54 70 66 50 82 Z', 3.6)
    path(c, 'M50 72 C38 62 28 54 28 42', 2)
    for (const [x, y] of [
      [90, 20],
      [10, 74],
      [86, 76],
    ]) {
      c.beginPath()
      c.arc(x, y, 2.4, 0, Math.PI * 2)
      c.fill()
    }
  },
  star: (c) => {
    // a nautical star: alternate points filled
    const pts: [number, number][] = []
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 ? 17 : 42
      pts.push([50 + Math.cos(a) * r, 52 + Math.sin(a) * r])
    }
    for (let i = 0; i < 10; i += 2) {
      const [px, py] = pts[i]
      const [lx, ly] = pts[(i + 9) % 10]
      const [rx, ry] = pts[(i + 1) % 10]
      c.beginPath()
      c.moveTo(50, 52)
      c.lineTo(px, py)
      c.lineTo(rx, ry)
      c.closePath()
      c.fill()
      c.beginPath()
      c.moveTo(50, 52)
      c.lineTo(px, py)
      c.lineTo(lx, ly)
      c.closePath()
      stroke(c, 2.4)
    }
  },
  moon: (c) => {
    path(c, 'M58 14 C34 18 22 40 28 60 C34 80 58 90 76 80 C56 80 42 64 44 46 C46 30 54 20 58 14 Z', 3.2, true)
    for (const [x, y, r] of [
      [70, 30, 5],
      [80, 52, 3.4],
      [62, 58, 2.6],
    ]) {
      c.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        const rr = i % 2 ? r * 0.35 : r
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
      }
      c.closePath()
      c.fill()
    }
  },
  snake: (c) => {
    path(c, 'M30 90 C70 84 74 66 50 60 C26 54 28 36 52 32 C66 30 70 22 64 14', 6)
    path(c, 'M30 90 C70 84 74 66 50 60 C26 54 28 36 52 32 C66 30 70 22 64 14', 2.2)
    c.strokeStyle = c.fillStyle
    path(c, 'M60 16 C62 8 72 8 72 14 C72 20 64 20 60 16 Z', 2.4, true)
    path(c, 'M72 12 l6 -3 M72 12 l6 2', 1.6)
  },
  script: (c) => {
    c.font = 'italic 600 34px Georgia, "Times New Roman", serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('faith', 50, 50)
    path(c, 'M14 64 C30 70 70 70 86 64', 1.6)
  },
  vine: (c) => {
    path(c, 'M50 96 C40 80 60 66 50 50 C40 34 60 20 50 4', 2.6)
    for (let i = 0; i < 6; i++) {
      const y = 86 - i * 15
      const s = i % 2 ? 1 : -1
      path(c, `M50 ${y} C${50 + s * 10} ${y - 8} ${50 + s * 20} ${y - 6} ${50 + s * 22} ${y - 12} C${50 + s * 14} ${y - 14} ${50 + s * 6} ${y - 8} 50 ${y} Z`, 2, true)
    }
  },
  dagger: (c) => {
    path(c, 'M50 6 L57 20 L57 62 L43 62 L43 20 Z', 3)
    path(c, 'M50 12 L50 60', 1.6)
    path(c, 'M30 62 L70 62 L70 68 L30 68 Z', 3, true)
    path(c, 'M45 68 L45 86 L55 86 L55 68', 3)
    c.beginPath()
    c.arc(50, 91, 5, 0, Math.PI * 2)
    c.fill()
  },
  sun: (c) => {
    c.beginPath()
    c.arc(50, 50, 16, 0, Math.PI * 2)
    stroke(c, 3.4)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6
      const r0 = 22
      const r1 = i % 2 ? 34 : 44
      c.beginPath()
      c.moveTo(50 + Math.cos(a - 0.12) * r0, 50 + Math.sin(a - 0.12) * r0)
      c.lineTo(50 + Math.cos(a) * r1, 50 + Math.sin(a) * r1)
      c.lineTo(50 + Math.cos(a + 0.12) * r0, 50 + Math.sin(a + 0.12) * r0)
      c.closePath()
      c.fill()
    }
  },
  swallow: (c) => {
    path(c, 'M18 40 C30 30 44 34 50 44 C56 34 70 30 84 40 C72 42 62 48 56 56 L62 84 L50 66 L38 84 L44 56 C38 48 28 42 18 40 Z', 3, true)
    c.save()
    c.globalCompositeOperation = 'destination-out'
    path(c, 'M44 50 C46 46 54 46 56 50', 2)
    c.restore()
  },
  band: (c) => {
    c.fillRect(0, 34, 100, 6)
    c.fillRect(0, 62, 100, 6)
    c.beginPath()
    for (let i = 0; i <= 10; i++) c.lineTo(i * 10, i % 2 ? 44 : 58)
    stroke(c, 3.2)
  },
}

interface Anchor {
  uv: [number, number]
  s: number
  up: [number, number]
  right?: [number, number]
}

/** One doll's tattoo ink, redrawn only when her tattoos (or a removal) change. */
export class TattooLayer {
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
  private key = ''

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = SIZE
    this.texture = new CanvasTexture(this.canvas)
    this.texture.flipY = false
    this.texture.colorSpace = NoColorSpace
    this.texture.generateMipmaps = true
    this.texture.minFilter = LinearMipmapLinearFilter
    this.texture.magFilter = LinearFilter
    this.texture.anisotropy = 4
  }

  /** Returns true when anything is inked. */
  update(tattoos: Tattoo[], care: CareData | undefined, fade: Partial<Record<TattooSpot, number>>): boolean {
    const anchors = care?.tattoos
    const key = JSON.stringify([tattoos, fade, !!anchors])
    if (key === this.key) return tattoos.length > 0 && !!anchors
    this.key = key
    const c = this.canvas.getContext('2d')
    if (!c) return false
    c.clearRect(0, 0, SIZE, SIZE)
    if (!anchors) return false
    for (const t of tattoos) {
      const a = anchors[t.at] as Anchor | undefined
      if (!a) continue
      const k = 1 - Math.min(1, fade[t.at] ?? 0)
      if (k <= 0.001) continue
      // (a scale far outside a body's ~0.3..1 UV per metre means a seam anchor: never paint it huge)
      if (!(a.s > 0.15 && a.s < 1.5)) continue
      const px = (BASE_M * t.size * a.s * SIZE) / 100 // canvas px per design unit
      c.save()
      c.translate(a.uv[0] * SIZE, a.uv[1] * SIZE)
      // design up (-y) onto the skin's up in UV
      const th = Math.atan2(a.up[1], a.up[0]) + Math.PI / 2
      c.rotate(th)
      // a mirrored UV island would draw the design back to front (text reversed): flip it back
      const mirrored = a.right ? a.right[0] * Math.cos(th) + a.right[1] * Math.sin(th) < 0 : false
      c.scale(mirrored ? -px : px, px)
      c.translate(-50, -50)
      c.globalAlpha = k
      c.fillStyle = c.strokeStyle = t.ink
      DESIGNS[t.design](c)
      c.restore()
    }
    this.texture.needsUpdate = true
    return tattoos.length > 0
  }

  dispose() {
    this.texture.dispose()
  }
}

/** A small preview of a design (store tiles). */
export function tattooPreview(design: TattooDesign, ink: string, size = 96): string {
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const c = cv.getContext('2d')
  if (!c) return ''
  c.scale(size / 100, size / 100)
  c.fillStyle = c.strokeStyle = ink
  DESIGNS[design](c)
  return cv.toDataURL()
}
