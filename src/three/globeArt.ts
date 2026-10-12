import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import land110 from 'world-atlas/land-110m.json'
import { CITIES } from '../shared/cities'
import type { AvatarSummary } from '../shared/types'

export const TEX_W = 2048
export const TEX_H = 1024

export interface EarthCanvases {
  color: HTMLCanvasElement
  /** City lights, used as an emissive map so cities glow. */
  lights: HTMLCanvasElement
  /** Alpha > 0 where there is land; used for tap hit-testing. */
  mask: HTMLCanvasElement
}

type Ring = [number, number][]

function rings(): Ring[] {
  const topo = land110 as unknown as Topology<{ land: GeometryCollection }>
  const fc = feature(topo, topo.objects.land) as unknown as { features: { geometry: { type: string; coordinates: unknown } }[] }
  const out: Ring[] = []
  for (const f of fc.features) {
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates as Ring[]] : (g.coordinates as Ring[][])
    for (const poly of polys) for (const ring of poly) out.push(ring)
  }
  return out
}

/** Draw land with longitudes unwrapped, three times across, so antimeridian rings stay closed. */
function drawLand(g: CanvasRenderingContext2D, allRings: Ring[]) {
  const x = (lon: number) => ((lon + 180) / 360) * TEX_W
  const y = (lat: number) => ((90 - lat) / 180) * TEX_H
  g.beginPath()
  for (const ring of allRings) {
    for (const offset of [-360, 0, 360]) {
      let prev = ring[0][0]
      let acc = 0
      ring.forEach(([lon, lat], i) => {
        if (i > 0) {
          const d = lon - prev
          if (d > 180) acc -= 360
          else if (d < -180) acc += 360
        }
        prev = lon
        const px = x(lon + acc + offset)
        const py = y(lat)
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      })
      g.closePath()
    }
  }
}

let ringCache: Ring[] | null = null

export function drawEarth(dark: boolean): EarthCanvases {
  ringCache ??= rings()
  const color = document.createElement('canvas')
  color.width = TEX_W
  color.height = TEX_H
  const g = color.getContext('2d')!
  // Night earth in the brand palette: ink oceans, plum-graphite land, blush coastlines.
  const ocean = g.createLinearGradient(0, 0, 0, TEX_H)
  ocean.addColorStop(0, dark ? '#0B080D' : '#1A1420')
  ocean.addColorStop(0.5, dark ? '#140F18' : '#241B2B')
  ocean.addColorStop(1, dark ? '#0B080D' : '#1A1420')
  g.fillStyle = ocean
  g.fillRect(0, 0, TEX_W, TEX_H)
  g.strokeStyle = 'rgba(199,202,209,0.06)'
  g.lineWidth = 1
  for (let lat = -60; lat <= 60; lat += 30) {
    const py = ((90 - lat) / 180) * TEX_H
    g.beginPath()
    g.moveTo(0, py)
    g.lineTo(TEX_W, py)
    g.stroke()
  }
  drawLand(g, ringCache)
  const landGrad = g.createLinearGradient(0, 0, 0, TEX_H)
  landGrad.addColorStop(0, '#3A2F3F')
  landGrad.addColorStop(0.5, '#4A3A4E')
  landGrad.addColorStop(1, '#3A2F3F')
  g.fillStyle = landGrad
  g.fill('evenodd')
  g.strokeStyle = 'rgba(245,212,218,0.55)'
  g.lineWidth = 1.4
  g.stroke()
  g.save()
  g.clip('evenodd')
  g.fillStyle = 'rgba(199,202,209,0.10)'
  for (let py = 4; py < TEX_H; py += 9) for (let px = (py / 9) % 2 ? 4 : 8.5; px < TEX_W; px += 9) g.fillRect(px, py, 2, 2)
  g.restore()

  const lights = drawCityLights()

  const mask = document.createElement('canvas')
  mask.width = TEX_W / 4
  mask.height = TEX_H / 4
  const m = mask.getContext('2d')!
  m.scale(0.25, 0.25)
  drawLand(m, ringCache)
  m.fillStyle = '#000'
  m.fill('evenodd')
  return { color, lights, mask }
}

export interface EarthPalette {
  /** Sea at the poles, then at the equator. */
  sea: [string, string]
  land: string
  /** Thick candy outline around the coasts. */
  outline: string
  /** Thin line on the coast itself. */
  edge: string
  dots: string
}

const CANDY: EarthPalette = { sea: ['#FFC9E0', '#FFDCEB'], land: '#FF6FAE', outline: '#FFFFFF', edge: '#E8418A', dots: 'rgba(255,255,255,0.75)' }

/** The gamified toy earth: bubblegum continents with candy outlines (pink unless a palette is given). */
export function drawCandyEarth(pal: EarthPalette = CANDY): HTMLCanvasElement {
  ringCache ??= rings()
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const g = c.getContext('2d')!
  const sea = g.createLinearGradient(0, 0, 0, TEX_H)
  sea.addColorStop(0, pal.sea[0])
  sea.addColorStop(0.5, pal.sea[1])
  sea.addColorStop(1, pal.sea[0])
  g.fillStyle = sea
  g.fillRect(0, 0, TEX_W, TEX_H)
  // Dotted latitude lines, like a toy globe.
  g.fillStyle = pal.dots
  for (let lat = -60; lat <= 60; lat += 20) {
    const py = ((90 - lat) / 180) * TEX_H
    for (let px = 0; px < TEX_W; px += 14) g.fillRect(px, py - 1.5, 5, 3)
  }
  drawLand(g, ringCache)
  // Thick white outline first, then the land on top, so coasts read as candy edges.
  g.strokeStyle = pal.outline
  g.lineWidth = 9
  g.lineJoin = 'round'
  g.stroke()
  g.fillStyle = pal.land
  g.fill('evenodd')
  g.save()
  g.clip('evenodd')
  g.fillStyle = 'rgba(255,255,255,0.28)'
  for (let py = 6; py < TEX_H; py += 16) for (let px = (py / 16) % 2 ? 6 : 14; px < TEX_W; px += 16) {
    g.beginPath()
    g.arc(px, py, 2.6, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
  g.strokeStyle = pal.edge
  g.lineWidth = 1.6
  g.stroke()
  return c
}

/** A regular toy earth: blue sea, green land with sandy belts, white poles. */
export function drawToyEarth(): HTMLCanvasElement {
  ringCache ??= rings()
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const g = c.getContext('2d')!
  const sea = g.createLinearGradient(0, 0, 0, TEX_H)
  sea.addColorStop(0, '#9FD8F2')
  sea.addColorStop(0.2, '#4FB0E3')
  sea.addColorStop(0.5, '#2E95D6')
  sea.addColorStop(0.8, '#4FB0E3')
  sea.addColorStop(1, '#9FD8F2')
  g.fillStyle = sea
  g.fillRect(0, 0, TEX_W, TEX_H)
  g.fillStyle = 'rgba(255,255,255,0.18)'
  for (let lat = -60; lat <= 60; lat += 20) {
    const py = ((90 - lat) / 180) * TEX_H
    for (let px = 0; px < TEX_W; px += 14) g.fillRect(px, py - 1, 5, 2)
  }
  drawLand(g, ringCache)
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 5
  g.lineJoin = 'round'
  g.stroke()
  const land = g.createLinearGradient(0, 0, 0, TEX_H)
  land.addColorStop(0, '#FFFFFF')
  land.addColorStop(0.1, '#E9F3F1')
  land.addColorStop(0.16, '#7CC576')
  land.addColorStop(0.3, '#5DBB63')
  land.addColorStop(0.36, '#D9B56B')
  land.addColorStop(0.43, '#79C26C')
  land.addColorStop(0.52, '#3FA552')
  land.addColorStop(0.6, '#6CBF62')
  land.addColorStop(0.66, '#CFAE69')
  land.addColorStop(0.76, '#6CC06A')
  land.addColorStop(0.86, '#EEF5F6')
  land.addColorStop(1, '#FFFFFF')
  g.fillStyle = land
  g.fill('evenodd')
  g.save()
  g.clip('evenodd')
  g.fillStyle = 'rgba(255,255,255,0.14)'
  for (let py = 6; py < TEX_H; py += 16)
    for (let px = (py / 16) % 2 ? 6 : 14; px < TEX_W; px += 16) {
      g.beginPath()
      g.arc(px, py, 2.2, 0, Math.PI * 2)
      g.fill()
    }
  g.restore()
  g.strokeStyle = 'rgba(30,90,50,0.55)'
  g.lineWidth = 1.4
  g.stroke()
  return c
}

/** Glowing city clusters. Lagos burns brightest. */
function drawCityLights(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = TEX_W
  c.height = TEX_H
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, TEX_W, TEX_H)
  let seed = 99
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const x = (lng: number) => ((lng + 180) / 360) * TEX_W
  const y = (lat: number) => ((90 - lat) / 180) * TEX_H
  for (const city of CITIES) {
    const big = city.name === 'Lagos' ? 2.2 : ['London', 'New York', 'Paris', 'Tokyo', 'Abuja', 'Accra', 'Johannesburg', 'Nairobi', 'Atlanta'].includes(city.name) ? 1.3 : 0.9
    const cx = x(city.lng)
    const cy = y(city.lat)
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, 14 * big)
    glow.addColorStop(0, 'rgba(255,236,245,0.95)')
    glow.addColorStop(0.35, 'rgba(255,120,190,0.45)')
    glow.addColorStop(1, 'rgba(255,46,136,0)')
    g.fillStyle = glow
    g.beginPath()
    g.arc(cx, cy, 14 * big, 0, Math.PI * 2)
    g.fill()
    const n = Math.round(40 * big)
    for (let i = 0; i < n; i++) {
      const r = Math.sqrt(rand()) * 22 * big
      const a = rand() * Math.PI * 2
      g.fillStyle = rand() < 0.25 ? 'rgba(200,255,61,0.7)' : 'rgba(255,230,240,0.85)'
      g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7, 1.6, 1.6)
    }
  }
  return c
}

export function isLand(mask: HTMLCanvasElement, lat: number, lng: number): boolean {
  const x = Math.floor(((lng + 180) / 360) * mask.width)
  const y = Math.floor(((90 - lat) / 180) * mask.height)
  const px = mask.getContext('2d')!.getImageData(Math.max(0, Math.min(mask.width - 1, x)), Math.max(0, Math.min(mask.height - 1, y)), 1, 1).data
  return px[3] > 0
}

/** Bubble drawing for globe pins when no rendered portrait exists. */
export function drawAvatarBubble(avatar: AvatarSummary, size = 96, portrait?: CanvasImageSource | null, ring = '#FF2E88'): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  // ring
  g.beginPath()
  g.arc(r, r, r - 1, 0, Math.PI * 2)
  g.fillStyle = '#FFFFFF'
  g.fill()
  g.save()
  g.beginPath()
  g.arc(r, r, r - size * 0.07, 0, Math.PI * 2)
  g.clip()
  if (portrait) {
    g.drawImage(portrait, 0, 0, size, size)
  } else {
    const bg = g.createRadialGradient(r, r * 0.7, 2, r, r, r)
    bg.addColorStop(0, '#F5D4DA')
    bg.addColorStop(1, '#D8D6DE')
    g.fillStyle = bg
    g.fillRect(0, 0, size, size)
    const s = size / 100
    const hair = g.createLinearGradient(0, 10 * s, 0, 90 * s)
    hair.addColorStop(0.3, avatar.hairColor)
    hair.addColorStop(1, avatar.hairColor2)
    g.fillStyle = hair
    const big = ['afro', 'puffs', 'high-puff'].includes(avatar.hairStyle)
    const long = ['locs', 'sisterlocs', 'freeform-locs', 'faux-locs', 'knotless-braids', 'box-braids', 'fulani-braids', 'twists', 'lace-front', 'sew-in', 'silk-press', 'bob', 'fringe-bob', 'long-straight', 'long-curly'].includes(avatar.hairStyle)
    if (big) {
      g.beginPath()
      g.arc(50 * s, 38 * s, 30 * s, 0, Math.PI * 2)
      g.fill()
    } else if (long) {
      g.fillRect(25 * s, 30 * s, 50 * s, 55 * s)
      g.beginPath()
      g.arc(50 * s, 38 * s, 25 * s, 0, Math.PI * 2)
      g.fill()
    } else if (avatar.hairStyle !== 'bald') {
      g.beginPath()
      g.arc(50 * s, 40 * s, 21 * s, Math.PI, 0)
      g.fill()
    }
    g.fillStyle = avatar.topColor
    g.beginPath()
    g.ellipse(50 * s, 100 * s, 34 * s, 22 * s, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = avatar.skin
    g.fillRect(44 * s, 62 * s, 12 * s, 14 * s)
    g.beginPath()
    g.ellipse(50 * s, 47 * s, 18 * s, 21 * s, 0, 0, Math.PI * 2)
    g.fill()
    if (avatar.accessory === 'gele') {
      g.fillStyle = '#C9A227'
      g.beginPath()
      g.ellipse(50 * s, 26 * s, 30 * s, 12 * s, 0, Math.PI, 0)
      g.fill()
    }
    g.fillStyle = '#FFFFFF'
    for (const ex of [43, 57]) {
      g.beginPath()
      g.ellipse(ex * s, 48 * s, 3.6 * s, 4.2 * s, 0, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = avatar.eyeColor
    for (const ex of [43.4, 57.4]) {
      g.beginPath()
      g.arc(ex * s, 48.5 * s, 2.4 * s, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = avatar.base === 'masculine' ? '#7A3E36' : avatar.lipColor
    g.beginPath()
    g.ellipse(50 * s, 58 * s, 5.5 * s, 2.2 * s, 0, 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
  g.lineWidth = size * 0.07
  g.strokeStyle = ring
  g.beginPath()
  g.arc(r, r, r - size * 0.04, 0, Math.PI * 2)
  g.stroke()
  return c
}

export function drawClusterBubble(count: number, size = 96): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r * 0.7, r * 0.6, 2, r, r, r)
  grad.addColorStop(0, '#FF7AB6')
  grad.addColorStop(1, '#FF2E88')
  g.fillStyle = grad
  g.beginPath()
  g.arc(r, r, r - 2, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = size * 0.06
  g.strokeStyle = '#FFFFFF'
  g.stroke()
  g.fillStyle = '#FFFFFF'
  g.font = `800 ${Math.round(size * (count > 99 ? 0.3 : 0.38))}px Unbounded, system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(count > 999 ? '999+' : String(count), r, r + size * 0.02)
  return c
}

export function drawRing(size = 128): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  g.lineWidth = size * 0.08
  g.strokeStyle = '#FF2E88'
  g.beginPath()
  g.arc(size / 2, size / 2, size / 2 - size * 0.06, 0, Math.PI * 2)
  g.stroke()
  return c
}

export function drawLabel(text: string, w = 256, h = 64): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.font = `800 ${Math.round(h * 0.5)}px Outfit, system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.shadowColor = 'rgba(255,46,136,0.9)'
  g.shadowBlur = 12
  g.fillStyle = '#FFFFFF'
  g.fillText(text, w / 2, h / 2)
  return c
}
