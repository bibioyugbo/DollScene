import type { TattooStyle } from '../shared/types'

type Draw = (g: CanvasRenderingContext2D, s: number) => void

export interface TattooDesign {
  id: string
  name: string
  style: TattooStyle
  draw: Draw
}

const line = (g: CanvasRenderingContext2D, w: number) => {
  g.lineWidth = w
  g.lineCap = 'round'
  g.lineJoin = 'round'
}

const spiral = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, turns: number, dir = 1) => {
  g.beginPath()
  for (let t = 0; t <= turns * Math.PI * 2; t += 0.1) {
    const rr = (r * t) / (turns * Math.PI * 2)
    const x = cx + Math.cos(t * dir) * rr
    const y = cy + Math.sin(t * dir) * rr
    if (t === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.stroke()
}

const petals = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, fill = false) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    g.beginPath()
    g.ellipse(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.45, r * 0.22, a, 0, Math.PI * 2)
    if (fill) g.fill()
    else g.stroke()
  }
}

const text = (g: CanvasRenderingContext2D, s: number, t: string, font: string) => {
  g.font = font.replace('$', String(Math.round(s * 0.26)))
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(t, s / 2, s / 2)
}

/** Tattoo library. Every design draws white-on-transparent; the renderer tints it. */
export const TATTOOS: TattooDesign[] = [
  { id: 'fine-rose', name: 'Fine-line rose', style: 'fine-line', draw: (g, s) => { line(g, s * 0.012); spiral(g, s / 2, s * 0.38, s * 0.14, 2.2); g.beginPath(); g.moveTo(s / 2, s * 0.52); g.quadraticCurveTo(s * 0.46, s * 0.75, s / 2, s * 0.92); g.stroke(); g.beginPath(); g.ellipse(s * 0.42, s * 0.68, s * 0.07, s * 0.03, -0.6, 0, Math.PI * 2); g.stroke() } },
  { id: 'fine-moon', name: 'Moon & stars', style: 'fine-line', draw: (g, s) => { line(g, s * 0.014); g.beginPath(); g.arc(s / 2, s / 2, s * 0.26, 0.6, Math.PI * 1.75); g.arc(s * 0.6, s * 0.44, s * 0.2, Math.PI * 1.6, 0.9, true); g.stroke(); for (const [x, y] of [[0.78, 0.25], [0.82, 0.62], [0.24, 0.2]]) { g.beginPath(); g.arc(s * x, s * y, s * 0.015, 0, 7); g.fill() } } },
  { id: 'butterfly', name: 'Butterfly', style: 'fine-line', draw: (g, s) => { line(g, s * 0.014); for (const d of [-1, 1]) { g.beginPath(); g.ellipse(s / 2 + d * s * 0.16, s * 0.4, s * 0.15, s * 0.12, d * 0.5, 0, 7); g.stroke(); g.beginPath(); g.ellipse(s / 2 + d * s * 0.12, s * 0.62, s * 0.1, s * 0.08, -d * 0.5, 0, 7); g.stroke() } g.beginPath(); g.moveTo(s / 2, s * 0.3); g.lineTo(s / 2, s * 0.72); g.stroke() } },
  { id: 'gye-nyame', name: 'Gye Nyame', style: 'adinkra', draw: (g, s) => { line(g, s * 0.07); g.beginPath(); g.arc(s / 2, s / 2, s * 0.3, Math.PI * 0.15, Math.PI * 0.85, true); g.stroke(); g.beginPath(); g.arc(s / 2, s / 2, s * 0.14, 0, 7); g.stroke(); for (const d of [-1, 1]) { g.beginPath(); g.arc(s / 2 + d * s * 0.3, s * 0.68, s * 0.08, 0, 7); g.stroke() } } },
  { id: 'sankofa', name: 'Sankofa', style: 'adinkra', draw: (g, s) => { line(g, s * 0.06); g.beginPath(); g.moveTo(s / 2, s * 0.85); g.bezierCurveTo(s * 0.05, s * 0.5, s * 0.25, s * 0.12, s / 2, s * 0.32); g.bezierCurveTo(s * 0.75, s * 0.12, s * 0.95, s * 0.5, s / 2, s * 0.85); g.stroke(); spiral(g, s * 0.35, s * 0.42, s * 0.08, 1.2); spiral(g, s * 0.65, s * 0.42, s * 0.08, 1.2, -1) } },
  { id: 'adinkrahene', name: 'Adinkrahene', style: 'adinkra', draw: (g, s) => { line(g, s * 0.05); for (const r of [0.1, 0.22, 0.34]) { g.beginPath(); g.arc(s / 2, s / 2, s * r, 0, 7); g.stroke() } } },
  { id: 'dwennimmen', name: 'Dwennimmen', style: 'adinkra', draw: (g, s) => { line(g, s * 0.05); spiral(g, s * 0.3, s * 0.3, s * 0.16, 1.5); spiral(g, s * 0.7, s * 0.3, s * 0.16, 1.5, -1); spiral(g, s * 0.3, s * 0.7, s * 0.16, 1.5, -1); spiral(g, s * 0.7, s * 0.7, s * 0.16, 1.5) } },
  { id: 'nkyinkyim', name: 'Nkyinkyim', style: 'adinkra', draw: (g, s) => { line(g, s * 0.06); g.beginPath(); for (let i = 0; i <= 6; i++) g.lineTo(s * (i % 2 ? 0.75 : 0.25), s * (0.1 + i * 0.13)); g.stroke() } },
  { id: 'tribal-band', name: 'Tribal band', style: 'tribal', draw: (g, s) => { g.beginPath(); g.moveTo(0, s * 0.4); for (let i = 0; i <= 8; i++) { g.lineTo(s * (i / 8), s * (i % 2 ? 0.25 : 0.42)); } g.lineTo(s, s * 0.6); for (let i = 8; i >= 0; i--) g.lineTo(s * (i / 8), s * (i % 2 ? 0.75 : 0.58)); g.closePath(); g.fill() } },
  { id: 'tribal-sun', name: 'Tribal sun', style: 'tribal', draw: (g, s) => { for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(s / 2 + Math.cos(a - 0.15) * s * 0.18, s / 2 + Math.sin(a - 0.15) * s * 0.18); g.lineTo(s / 2 + Math.cos(a) * s * 0.45, s / 2 + Math.sin(a) * s * 0.45); g.lineTo(s / 2 + Math.cos(a + 0.15) * s * 0.18, s / 2 + Math.sin(a + 0.15) * s * 0.18); g.fill() } g.beginPath(); g.arc(s / 2, s / 2, s * 0.15, 0, 7); g.fill() } },
  { id: 'script-love', name: 'Ìfẹ́ (love)', style: 'script', draw: (g, s) => text(g, s, 'Ìfẹ́', 'italic 600 $px Georgia, serif') },
  { id: 'script-mama', name: 'Mama', style: 'script', draw: (g, s) => text(g, s, 'Mama', 'italic 600 $px Georgia, serif') },
  { id: 'script-naija', name: 'Naija', style: 'script', draw: (g, s) => text(g, s, 'Naija', 'italic 700 $px Georgia, serif') },
  { id: 'script-blessed', name: 'Blessed', style: 'script', draw: (g, s) => text(g, s, 'blessed', 'italic 500 $px "Brush Script MT", cursive') },
  { id: 'rose', name: 'Rose', style: 'floral', draw: (g, s) => { line(g, s * 0.03); g.globalAlpha = 0.9; petals(g, s / 2, s * 0.4, s * 0.3, 6, true); g.globalAlpha = 1; spiral(g, s / 2, s * 0.4, s * 0.1, 2); g.beginPath(); g.moveTo(s / 2, s * 0.6); g.lineTo(s / 2, s * 0.95); g.stroke() } },
  { id: 'hibiscus', name: 'Hibiscus', style: 'floral', draw: (g, s) => { line(g, s * 0.025); petals(g, s / 2, s / 2, s * 0.42, 5); g.beginPath(); g.moveTo(s / 2, s / 2); g.lineTo(s * 0.7, s * 0.3); g.stroke() } },
  { id: 'vine', name: 'Vine', style: 'floral', draw: (g, s) => { line(g, s * 0.025); g.beginPath(); g.moveTo(s * 0.1, s * 0.9); g.bezierCurveTo(s * 0.4, s * 0.6, s * 0.2, s * 0.3, s * 0.9, s * 0.1); g.stroke(); for (let i = 1; i < 6; i++) { g.beginPath(); g.ellipse(s * (0.1 + i * 0.14), s * (0.85 - i * 0.14), s * 0.05, s * 0.025, -0.8, 0, 7); g.fill() } } },
  { id: 'triangle', name: 'Triangles', style: 'geometric', draw: (g, s) => { line(g, s * 0.025); for (const k of [0.4, 0.28, 0.16]) { g.beginPath(); g.moveTo(s / 2, s * (0.5 - k)); g.lineTo(s * (0.5 + k), s * (0.5 + k * 0.8)); g.lineTo(s * (0.5 - k), s * (0.5 + k * 0.8)); g.closePath(); g.stroke() } } },
  { id: 'mandala', name: 'Mandala', style: 'geometric', draw: (g, s) => { line(g, s * 0.015); petals(g, s / 2, s / 2, s * 0.44, 12); petals(g, s / 2, s / 2, s * 0.26, 8); g.beginPath(); g.arc(s / 2, s / 2, s * 0.06, 0, 7); g.fill() } },
  { id: 'hexes', name: 'Hexes', style: 'geometric', draw: (g, s) => { line(g, s * 0.02); for (const [x, y] of [[0.5, 0.3], [0.33, 0.6], [0.67, 0.6]]) { g.beginPath(); for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI * 2; g.lineTo(s * x + Math.cos(a) * s * 0.15, s * y + Math.sin(a) * s * 0.15) } g.stroke() } } },
  { id: 'heart-dagger', name: 'Heart & dagger', style: 'traditional', draw: (g, s) => { g.beginPath(); g.moveTo(s / 2, s * 0.8); g.bezierCurveTo(s * 0.05, s * 0.45, s * 0.3, s * 0.15, s / 2, s * 0.35); g.bezierCurveTo(s * 0.7, s * 0.15, s * 0.95, s * 0.45, s / 2, s * 0.8); g.fill(); line(g, s * 0.03); g.beginPath(); g.moveTo(s * 0.2, s * 0.15); g.lineTo(s * 0.85, s * 0.85); g.stroke() } },
  { id: 'swallow', name: 'Swallow', style: 'traditional', draw: (g, s) => { g.beginPath(); g.moveTo(s * 0.1, s * 0.4); g.quadraticCurveTo(s * 0.5, s * 0.2, s * 0.9, s * 0.35); g.lineTo(s * 0.6, s * 0.5); g.lineTo(s * 0.75, s * 0.85); g.lineTo(s * 0.5, s * 0.6); g.lineTo(s * 0.25, s * 0.8); g.lineTo(s * 0.35, s * 0.5); g.closePath(); g.fill() } },
  { id: 'anchor', name: 'Anchor', style: 'traditional', draw: (g, s) => { line(g, s * 0.05); g.beginPath(); g.moveTo(s / 2, s * 0.2); g.lineTo(s / 2, s * 0.85); g.moveTo(s * 0.3, s * 0.35); g.lineTo(s * 0.7, s * 0.35); g.stroke(); g.beginPath(); g.arc(s / 2, s * 0.55, s * 0.3, 0.2, Math.PI - 0.2); g.stroke(); g.beginPath(); g.arc(s / 2, s * 0.14, s * 0.06, 0, 7); g.stroke() } },
  { id: 'lion', name: 'Lion', style: 'realism', draw: (g, s) => { g.globalAlpha = 0.5; petals(g, s / 2, s / 2, s * 0.48, 14, true); g.globalAlpha = 1; g.beginPath(); g.ellipse(s / 2, s * 0.52, s * 0.2, s * 0.24, 0, 0, 7); g.fill(); g.globalCompositeOperation = 'destination-out'; for (const d of [-1, 1]) { g.beginPath(); g.arc(s / 2 + d * s * 0.08, s * 0.46, s * 0.03, 0, 7); g.fill() } g.beginPath(); g.moveTo(s * 0.44, s * 0.6); g.lineTo(s * 0.56, s * 0.6); g.lineTo(s / 2, s * 0.66); g.fill(); g.globalCompositeOperation = 'source-over' } },
  { id: 'eye', name: 'All-seeing eye', style: 'realism', draw: (g, s) => { line(g, s * 0.025); g.beginPath(); g.moveTo(s * 0.1, s / 2); g.quadraticCurveTo(s / 2, s * 0.15, s * 0.9, s / 2); g.quadraticCurveTo(s / 2, s * 0.85, s * 0.1, s / 2); g.stroke(); g.beginPath(); g.arc(s / 2, s / 2, s * 0.13, 0, 7); g.fill() } },
  { id: 'ankh', name: 'Ankh', style: 'afrofuturist', draw: (g, s) => { line(g, s * 0.07); g.beginPath(); g.ellipse(s / 2, s * 0.28, s * 0.12, s * 0.16, 0, 0, 7); g.moveTo(s / 2, s * 0.44); g.lineTo(s / 2, s * 0.92); g.moveTo(s * 0.25, s * 0.52); g.lineTo(s * 0.75, s * 0.52); g.stroke() } },
  { id: 'planet', name: 'Afro-planet', style: 'afrofuturist', draw: (g, s) => { g.beginPath(); g.arc(s / 2, s / 2, s * 0.2, 0, 7); g.fill(); line(g, s * 0.03); g.beginPath(); g.ellipse(s / 2, s / 2, s * 0.42, s * 0.12, -0.4, 0, 7); g.stroke() } },
  { id: 'crown', name: 'Crown', style: 'afrofuturist', draw: (g, s) => { g.beginPath(); g.moveTo(s * 0.15, s * 0.75); g.lineTo(s * 0.15, s * 0.35); g.lineTo(s * 0.33, s * 0.55); g.lineTo(s / 2, s * 0.25); g.lineTo(s * 0.67, s * 0.55); g.lineTo(s * 0.85, s * 0.35); g.lineTo(s * 0.85, s * 0.75); g.closePath(); g.fill() } },
  { id: 'henna-hand', name: 'Henna mandala', style: 'henna', draw: (g, s) => { line(g, s * 0.018); petals(g, s / 2, s / 2, s * 0.3, 10); for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.beginPath(); g.arc(s / 2 + Math.cos(a) * s * 0.42, s / 2 + Math.sin(a) * s * 0.42, s * 0.018, 0, 7); g.fill() } } },
  { id: 'henna-vine', name: 'Henna vine', style: 'henna', draw: (g, s) => { line(g, s * 0.02); g.beginPath(); g.moveTo(s * 0.5, s * 0.05); g.bezierCurveTo(s * 0.2, s * 0.35, s * 0.8, s * 0.6, s * 0.5, s * 0.95); g.stroke(); for (let i = 1; i < 8; i++) { g.beginPath(); g.arc(s * (0.5 + Math.sin(i) * 0.16), s * (i / 8), s * 0.03, 0, 7); g.stroke() } } },
  { id: 'paint-dots', name: 'Dot paint', style: 'body-paint', draw: (g, s) => { for (let r = 0; r < 4; r++) for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(s * (0.15 + i * 0.14), s * (0.2 + r * 0.2), s * 0.03, 0, 7); g.fill() } } },
  { id: 'paint-stripes', name: 'Stripe paint', style: 'body-paint', draw: (g, s) => { line(g, s * 0.05); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * 0.1, s * (0.2 + i * 0.2)); g.quadraticCurveTo(s / 2, s * (0.1 + i * 0.2), s * 0.9, s * (0.2 + i * 0.2)); g.stroke() } } },
]

export const TATTOO_BY_ID = new Map(TATTOOS.map((t) => [t.id, t]))

export const TATTOO_STYLE_LABEL: Record<TattooStyle, string> = {
  'fine-line': 'Fine line',
  adinkra: 'Adinkra',
  tribal: 'Tribal',
  script: 'Script',
  floral: 'Floral',
  geometric: 'Geometric',
  traditional: 'Traditional',
  realism: 'Realism',
  afrofuturist: 'Afro-futurist',
  henna: 'Henna',
  'body-paint': 'Body paint',
}

const canvasCache = new Map<string, HTMLCanvasElement>()

/** Draw a design tinted with a colour (null = black and grey). */
export function tattooCanvas(id: string, color: string | null, size = 256): HTMLCanvasElement {
  const key = `${id}|${color}|${size}`
  const cached = canvasCache.get(key)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const ink = color ?? '#1D1A1F'
  g.fillStyle = ink
  g.strokeStyle = ink
  ;(TATTOO_BY_ID.get(id) ?? TATTOOS[0]).draw(g, size)
  if (!color) {
    // Black-and-grey: soften with a grey wash inside the ink.
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = 'rgba(90,90,96,0.25)'
    g.fillRect(0, size * 0.5, size, size * 0.5)
    g.globalCompositeOperation = 'source-over'
  }
  canvasCache.set(key, c)
  return c
}
