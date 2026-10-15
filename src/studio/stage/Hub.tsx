import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  MathUtils,
  RepeatWrapping,
  RingGeometry,
  Shape,
  SRGBColorSpace,
  type Group,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type PerspectiveCamera,
  type PointLight,
} from 'three'
import { create } from 'zustand'
import { useRealtime } from '../net/realtime'
import { DOORS, type DoorDef, type DoorId, type Facade } from '../rooms'
import { chime, click, haptic, sfx } from '../ui/sound'

/**
 * The Hub: a high street at golden hour, curved like a game map. The stores stand round a wide
 * arc (about a half circle) facing a plaza; from the raised view the street sweeps from one edge of
 * the screen to the other. Every store is its own building (brick and a sawtooth roof, a gabled
 * boutique, velvet under a mansard, a cantilevered glass gym, an art-deco crown, a spa dome, a
 * columned clinic, a cinema marquee...), with real signage, lit display windows showing what's
 * inside and a door that opens. Arrow keys, the wheel/trackpad or a swipe move store to store (the
 * active one glows and chimes); tap a store or press Enter to go in. When other players are inside
 * a store, "People already here" shows over its door.
 */

const EYE = 1.62
const FRONT = -6 // the shopfronts' plane
const GAP = 0.6
/** The street's curve: a straight street (x along it, z across) bent round a circle of radius R. */
const R = 15

/** Building centres along the street. */
const LAYOUT = (() => {
  const total = DOORS.reduce((s, d) => s + d.width, 0) + GAP * (DOORS.length - 1)
  let x = -total / 2
  return DOORS.map((d) => {
    const c = x + d.width / 2
    x += d.width + GAP
    return c
  })
})()
/** The kerb-to-floor step: pavements and shop floors sit this high above the road. */
const KERB = 0.14
/** Where the door sits across a building's front (glass-fronted stores put it at the side). */
const doorWidth = (d: DoorDef) => (d.facade === 'cinema' ? 1.5 : 1.05)
const doorOffset = (d: DoorDef) => (d.facade === 'gym' || d.facade === 'glass' ? d.width / 2 - doorWidth(d) / 2 - 0.35 : 0)
const X_MIN = LAYOUT[0] - 1
const X_MAX = LAYOUT[LAYOUT.length - 1] + 1

/** Bend a point of the straight street onto the curve: [x, y, z] and the yaw that faces the plaza. */
export function arc(x: number, y: number, z: number): { position: [number, number, number]; rotation: [number, number, number] } {
  const th = x / R
  const r = R - (z - FRONT)
  return { position: [r * Math.sin(th), y, -r * Math.cos(th)], rotation: [0, -th, 0] }
}
/** A flat ring band of the street (distance d0..d1 out from the shopfronts), across x0..x1. */
function band(d0: number, d1: number, x0 = X_MIN - 8, x1 = X_MAX + 8, seg = 160) {
  const t0 = x0 / R
  const t1 = x1 / R
  return new RingGeometry(R - d1, R - d0, seg, 1, Math.PI / 2 - t1, t1 - t0)
}
/** Nearest store to a point along the street. */
const nearest = (x: number) => {
  let i = 0
  for (let k = 0; k < LAYOUT.length; k++) if (Math.abs(LAYOUT[k] - x) < Math.abs(LAYOUT[i] - x)) i = k
  return i
}

interface HubState {
  /** Where the player stands along the pavement (m). */
  x: number
  hovered: DoorId | null
  /** Walking across and through a door: 0..1. */
  entering: { id: DoorId; t: number } | null
  /** Drag: walk along the street (the drag delta in radians from the stage, ~ metres / 4). */
  look: (d: number) => void
  /** Wheel / trackpad: one store per notch (a short cooldown so a flick doesn't fly past). */
  wheel: (delta: number) => void
  setHovered: (d: DoorId | null) => void
  /** When the last drag moved the street (the camera settles on the nearest store after). */
  dragAt: number
  wheelAcc: number
  wheelAt: number
}

const START = Math.max(
  0,
  DOORS.findIndex((d) => d.id === 'glam'),
)

export const useHub = create<HubState>((set, get) => ({
  x: LAYOUT[START],
  hovered: null,
  entering: null,
  dragAt: 0,
  wheelAcc: 0,
  wheelAt: 0,
  look: (d) => {
    const x = MathUtils.clamp(get().x + d * 4, X_MIN, X_MAX)
    set({ x, dragAt: performance.now(), hovered: DOORS[nearest(x)].id })
  },
  wheel: (delta) => {
    const now = performance.now()
    const s = get()
    if (s.entering) return
    const acc = (now - s.wheelAt > 400 ? 0 : s.wheelAcc) + delta
    if (Math.abs(acc) < 40 || now - s.wheelAt < 260) return set({ wheelAcc: acc })
    set({ wheelAcc: 0, wheelAt: now })
    lookToDoor(acc > 0 ? 1 : -1)
  },
  setHovered: (hovered) => set({ hovered }),
}))

/** The active store changed: a small chime, pitched per store (so moving along "plays" the street). */
const NOTES = [523, 587, 659, 784, 880, 988, 1047, 1175, 1319, 1568, 1760, 2093]
useHub.subscribe((s, p) => {
  if (s.hovered && s.hovered !== p.hovered && !s.entering) chime(NOTES[DOORS.findIndex((d) => d.id === s.hovered) % NOTES.length])
})

/** Walk to the next/previous store. */
export function lookToDoor(dir: 1 | -1) {
  const s = useHub.getState()
  if (s.entering) return
  const j = MathUtils.clamp(nearest(s.x) + dir, 0, DOORS.length - 1)
  useHub.setState({ x: LAYOUT[j], hovered: DOORS[j].id, dragAt: 0 })
}

/** Go into the active store (Enter key). */
export function enterActive() {
  const s = useHub.getState()
  if (s.entering) return
  const d = DOORS[nearest(s.x)]
  enterHandler?.(d.id)
}
let enterHandler: ((id: DoorId) => void) | null = null

/* ------------------------------------------------------------------ painted textures */

const cache = new Map<string, CanvasTexture>()
function paint(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): CanvasTexture {
  let t = cache.get(key)
  if (t) return t
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!, w, h)
  t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 8
  if (repeat) {
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(...repeat)
  }
  cache.set(key, t)
  return t
}

/** Deterministic noise for the painters (same look every load). */
function rnd(seed: number) {
  let a = seed >>> 0 || 1
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const shade = (hex: string, k: number) => {
  const c = new Color(hex)
  c.offsetHSL(0, 0, k)
  return `#${c.getHexString()}`
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, color: string, alpha: number, seed: number) {
  const r = rnd(seed)
  g.fillStyle = color
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * r()
    g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2)
  }
  g.globalAlpha = 1
}

/** Wall materials: brick, stucco, planks, tiles, marble, concrete, glass curtain, terracotta. */
export function wallTexture(kind: Facade, color: string): CanvasTexture {
  return paint(`wall:${kind}:${color}`, 512, 512, (g, w, h) => {
    const r = rnd(kind.length * 97 + color.charCodeAt(2))
    switch (kind) {
      case 'brick': {
        g.fillStyle = '#7a6e66'
        g.fillRect(0, 0, w, h)
        const bw = 64
        const bh = 24
        for (let y = 0; y < h; y += bh + 4) {
          const off = ((y / (bh + 4)) % 2) * (bw / 2)
          for (let x = -bw; x < w + bw; x += bw + 4) {
            g.fillStyle = shade(color, (r() - 0.5) * 0.12)
            g.fillRect(x + off, y, bw, bh)
            g.fillStyle = 'rgba(0,0,0,0.18)'
            g.fillRect(x + off, y + bh - 4, bw, 4)
          }
        }
        speckle(g, w, h, 5000, '#000', 0.25, 3)
        break
      }
      case 'thrift':
      case 'heritage': {
        // painted planks (thrift) or terracotta plaster (heritage)
        if (kind === 'thrift') {
          for (let x = 0; x < w; x += 42) {
            g.fillStyle = shade(color, (r() - 0.5) * 0.08)
            g.fillRect(x, 0, 42, h)
            g.fillStyle = 'rgba(0,0,0,0.25)'
            g.fillRect(x, 0, 3, h)
            g.strokeStyle = 'rgba(0,0,0,0.08)'
            for (let k = 0; k < 6; k++) {
              g.beginPath()
              const gx = x + 6 + r() * 30
              g.moveTo(gx, 0)
              g.bezierCurveTo(gx + 6, h * 0.3, gx - 6, h * 0.6, gx + 3, h)
              g.stroke()
            }
          }
        } else {
          g.fillStyle = color
          g.fillRect(0, 0, w, h)
          speckle(g, w, h, 9000, '#3a1a08', 0.18, 5)
          speckle(g, w, h, 4000, '#fff', 0.1, 6)
        }
        break
      }
      case 'spa':
      case 'clinic': {
        // large pale tiles / limestone panels
        g.fillStyle = color
        g.fillRect(0, 0, w, h)
        const s = kind === 'spa' ? 128 : 170
        g.strokeStyle = 'rgba(0,0,0,0.12)'
        g.lineWidth = 3
        for (let y = 0; y <= h; y += s) {
          g.beginPath()
          g.moveTo(0, y)
          g.lineTo(w, y)
          g.stroke()
        }
        for (let x = 0; x <= w; x += s) {
          g.beginPath()
          g.moveTo(x, 0)
          g.lineTo(x, h)
          g.stroke()
        }
        speckle(g, w, h, 3000, '#000', 0.06, 7)
        break
      }
      case 'gold': {
        // black marble with gold and white veins
        g.fillStyle = '#0d0c0c'
        g.fillRect(0, 0, w, h)
        for (let i = 0; i < 26; i++) {
          g.strokeStyle = i % 3 ? 'rgba(255,255,255,0.12)' : 'rgba(217,179,91,0.55)'
          g.lineWidth = 0.6 + r() * 2.2
          g.beginPath()
          let x = r() * w
          let y = 0
          g.moveTo(x, y)
          while (y < h) {
            x += (r() - 0.5) * 60
            y += 20 + r() * 50
            g.lineTo(x, y)
          }
          g.stroke()
        }
        break
      }
      case 'gym': {
        // board-formed concrete
        g.fillStyle = color
        g.fillRect(0, 0, w, h)
        for (let y = 0; y < h; y += 32) {
          g.fillStyle = `rgba(0,0,0,${0.03 + r() * 0.05})`
          g.fillRect(0, y, w, 32)
        }
        speckle(g, w, h, 12000, '#000', 0.12, 8)
        g.fillStyle = 'rgba(0,0,0,0.25)'
        for (const [x, y] of [
          [64, 64],
          [448, 64],
          [64, 448],
          [448, 448],
        ])
          g.fillRect(x, y, 6, 6)
        break
      }
      case 'glass': {
        // dark tinted glass curtain wall with mullions and a sky reflection
        const gr = g.createLinearGradient(0, 0, w, h)
        gr.addColorStop(0, '#2a1830')
        gr.addColorStop(0.5, '#4a2a48')
        gr.addColorStop(1, '#140810')
        g.fillStyle = gr
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#0a0508'
        for (let x = 0; x <= w; x += 128) g.fillRect(x - 4, 0, 8, h)
        for (let y = 0; y <= h; y += 170) g.fillRect(0, y - 4, w, 8)
        break
      }
      default: {
        // smooth painted render (boutique, velvet, salon, cinema)
        g.fillStyle = color
        g.fillRect(0, 0, w, h)
        speckle(g, w, h, 7000, '#000', 0.05, 9)
        speckle(g, w, h, 3000, '#fff', 0.06, 10)
      }
    }
  })
}

/** The shop sign, in each store's own lettering. */
export function signTexture(d: DoorDef, fontsTick: number): CanvasTexture {
  return paint(`sign:${d.id}:${fontsTick}`, 1024, 256, (g, w, h) => {
    const sans = '"Red Hat Display", system-ui, sans-serif'
    const glow = (c: string, b: number) => ((g.shadowColor = c), (g.shadowBlur = b))
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    const fit = (text: string, font: (px: number) => string, max: number, start: number) => {
      let px = start
      g.font = font(px)
      while (g.measureText(text).width > max && px > 20) g.font = font((px -= 4))
    }
    switch (d.facade) {
      case 'brick': // Tolaptsd: a black board, white block letters, red neon
        g.fillStyle = '#0b0b0c'
        g.fillRect(0, 0, w, h)
        g.strokeStyle = '#ff2d2d'
        g.lineWidth = 8
        glow('#ff2d2d', 30)
        g.strokeRect(18, 18, w - 36, h - 36)
        fit(d.name.toUpperCase(), (px) => `900 ${px}px ${sans}`, 900, 150)
        g.fillStyle = '#fff'
        glow('#ff3b3b', 26)
        g.fillText(d.name.toUpperCase(), w / 2, h / 2 + 6)
        break
      case 'boutique': // Thai Collective: cream board, black serif, a gold butterfly
        g.fillStyle = '#f6efe2'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#c9a04a'
        g.fillRect(0, h - 14, w, 14)
        fit(d.name, (px) => `400 ${px}px Georgia, "Times New Roman", serif`, 760, 120)
        g.fillStyle = '#141414'
        g.fillText(d.name, w / 2 + 50, h / 2)
        g.fillStyle = '#d9a441'
        for (const s of [1, -1]) {
          g.beginPath()
          g.ellipse(110 + s * 22, h / 2 - 16, 26, 18, s * -0.6, 0, Math.PI * 2)
          g.fill()
          g.beginPath()
          g.ellipse(110 + s * 16, h / 2 + 18, 16, 14, s * 0.5, 0, Math.PI * 2)
          g.fill()
        }
        break
      case 'velvet': // Mon Cherie: pink neon script
        g.fillStyle = '#2a0c16'
        g.fillRect(0, 0, w, h)
        fit(d.name, (px) => `italic 700 ${px}px "Snell Roundhand", "Brush Script MT", "Segoe Script", cursive`, 900, 150)
        g.strokeStyle = '#ff8fb1'
        g.lineWidth = 6
        glow('#ff4f8b', 40)
        g.strokeText(d.name, w / 2, h / 2 + 4)
        g.fillStyle = '#ffe3ec'
        g.fillText(d.name, w / 2, h / 2 + 4)
        break
      case 'gym': // Nova Sport: heavy italic, a cyan swoosh-free stripe
        g.fillStyle = '#10161f'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#2de1c2'
        g.beginPath()
        g.moveTo(0, h - 40)
        g.lineTo(w, h - 70)
        g.lineTo(w, h - 54)
        g.lineTo(0, h - 24)
        g.fill()
        fit(d.name.toUpperCase(), (px) => `italic 900 ${px}px ${sans}`, 900, 140)
        g.fillStyle = '#ffffff'
        glow('#5cf2ff', 18)
        g.fillText(d.name.toUpperCase(), w / 2, h / 2 - 10)
        break
      case 'gold': // Dope by Fabby: gold serif capitals on black marble
        g.drawImage(wallTexture('gold', '#000').image as HTMLCanvasElement, 0, 0, w, h)
        fit(d.name.toUpperCase(), (px) => `600 ${px}px "Didot", "Bodoni 72", Georgia, serif`, 900, 120)
        {
          const gr = g.createLinearGradient(0, 40, 0, h - 40)
          gr.addColorStop(0, '#fff3c4')
          gr.addColorStop(0.5, '#d9b35b')
          gr.addColorStop(1, '#9a7426')
          g.fillStyle = gr
        }
        glow('#ffd56a', 20)
        g.fillText(d.name.toUpperCase(), w / 2, h / 2 + 4)
        break
      case 'heritage': {
        // Deji Deji: carved wood board, gold letters, an adire border
        const gr = g.createLinearGradient(0, 0, 0, h)
        gr.addColorStop(0, '#6b3a1e')
        gr.addColorStop(1, '#3e1f0e')
        g.fillStyle = gr
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#d9a441'
        for (let x = 10; x < w; x += 40) {
          g.beginPath()
          g.moveTo(x, 10)
          g.lineTo(x + 20, 30)
          g.lineTo(x + 40, 10)
          g.fill()
          g.beginPath()
          g.moveTo(x, h - 10)
          g.lineTo(x + 20, h - 30)
          g.lineTo(x + 40, h - 10)
          g.fill()
        }
        fit(d.name.toUpperCase(), (px) => `900 ${px}px ${sans}`, 820, 120)
        g.fillStyle = '#ffd78a'
        glow('#000', 8)
        g.fillText(d.name.toUpperCase(), w / 2, h / 2 + 4)
        break
      }
      case 'spa': // Skin Bay: frosted board, light letters, a leaf
        g.fillStyle = '#e8f4f0'
        g.fillRect(0, 0, w, h)
        fit(d.name, (px) => `300 ${px}px ${sans}`, 760, 130)
        g.fillStyle = '#245a4e'
        g.fillText(d.name, w / 2 + 40, h / 2 + 4)
        g.fillStyle = '#4fa68e'
        g.beginPath()
        g.ellipse(150, h / 2, 46, 22, -0.7, 0, Math.PI * 2)
        g.fill()
        break
      case 'clinic': // Beauty Doctor: clean lavender sans on white, a sparkle
        g.fillStyle = '#fbfaff'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#7a5ac8'
        fit(d.name, (px) => `700 ${px}px ${sans}`, 760, 120)
        g.fillText(d.name, w / 2 + 40, h / 2 + 4)
        g.save()
        g.translate(140, h / 2)
        g.beginPath()
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4
          const rr = i % 2 ? 14 : 46
          g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
        }
        g.fill()
        g.restore()
        break
      case 'thrift': // Okrika Closet: hand-painted retro letters on a wood board
        g.fillStyle = '#e9d6b0'
        g.fillRect(0, 0, w, h)
        g.strokeStyle = '#6b4a2e'
        g.lineWidth = 12
        g.strokeRect(10, 10, w - 20, h - 20)
        fit(d.name, (px) => `italic 900 ${px}px Georgia, serif`, 880, 130)
        g.fillStyle = '#b5552a'
        g.fillText(d.name, w / 2 + 4, h / 2 + 8)
        g.fillStyle = '#2e5a3a'
        g.fillText(d.name, w / 2, h / 2 + 4)
        break
      case 'glass': // BOOTY: hot-pink neon capitals, 18+
        g.fillStyle = '#12040a'
        g.fillRect(0, 0, w, h)
        fit(d.name, (px) => `900 ${px}px ${sans}`, 700, 170)
        g.strokeStyle = '#ff4fa3'
        g.lineWidth = 7
        glow('#ff2d8f', 44)
        g.strokeText(d.name, w / 2 - 40, h / 2 + 6)
        g.fillStyle = '#ffd6ea'
        g.fillText(d.name, w / 2 - 40, h / 2 + 6)
        g.font = `800 44px ${sans}`
        g.fillStyle = '#ff4fa3'
        g.fillText('18+', w - 110, h / 2 + 6)
        break
      case 'cinema': // Make a Scene: a marquee board ringed with bulbs
        g.fillStyle = '#f7f1e3'
        g.fillRect(0, 0, w, h)
        g.fillStyle = '#b3121b'
        g.fillRect(0, 0, w, 26)
        g.fillRect(0, h - 26, w, 26)
        fit(d.name.toUpperCase(), (px) => `900 ${px}px ${sans}`, 880, 130)
        g.fillStyle = '#141414'
        g.fillText(d.name.toUpperCase(), w / 2, h / 2 + 4)
        break
      case 'salon': // Glam Studio: blush board, white script, a mirror of bulbs
      default:
        g.fillStyle = '#2a1720'
        g.fillRect(0, 0, w, h)
        fit(d.name, (px) => `italic 800 ${px}px ${sans}`, 820, 140)
        g.fillStyle = '#ffd1e6'
        glow('#ff9bc8', 26)
        g.fillText(d.name, w / 2, h / 2 + 4)
        g.shadowBlur = 0
        g.fillStyle = '#ffe6c4'
        for (let x = 30; x < w; x += 60) {
          g.beginPath()
          g.arc(x, 20, 7, 0, Math.PI * 2)
          g.arc(x, h - 20, 7, 0, Math.PI * 2)
          g.fill()
        }
    }
  })
}

/** What you see through the display window: each store's own interior. */
export function interiorTexture(d: DoorDef, scale = 1): CanvasTexture {
  return paint(`inside:${d.id}:${scale}`, 512 * scale, 256 * scale, (g, W, H) => {
    g.scale(scale, scale)
    const w = W / scale
    const h = H / scale
    const r = rnd(d.id.length * 131 + d.id.charCodeAt(0))
    const wall = {
      brick: '#2a1416',
      boutique: '#fbf0d8',
      velvet: '#c2577a',
      gym: '#e9eef4',
      salon: '#f4d6e0',
      gold: '#16120a',
      heritage: '#c9733a',
      spa: '#e3f2ec',
      clinic: '#f3f0fb',
      thrift: '#e8d2a8',
      glass: '#4a0e2a',
      cinema: '#3a0c10',
    }[d.facade]
    g.fillStyle = wall
    g.fillRect(0, 0, w, h)
    // warm ceiling spots
    for (let x = 40; x < w; x += 110) {
      const gr = g.createRadialGradient(x, 0, 4, x, 40, 130)
      gr.addColorStop(0, 'rgba(255,240,210,0.85)')
      gr.addColorStop(1, 'rgba(255,240,210,0)')
      g.fillStyle = gr
      g.fillRect(x - 130, 0, 260, 200)
    }
    // floor
    g.fillStyle = shade(wall, -0.25)
    g.fillRect(0, h * 0.78, w, h * 0.22)
    const pal = [d.frame, d.glow, shade(d.frame, 0.2), '#ffffff', shade(d.door, 0.15), '#141414']
    const rack = (x0: number, x1: number, y: number) => {
      g.strokeStyle = '#c0c0c8'
      g.lineWidth = 4
      g.beginPath()
      g.moveTo(x0, y)
      g.lineTo(x1, y)
      g.moveTo(x0 + 6, y)
      g.lineTo(x0 + 6, h * 0.8)
      g.moveTo(x1 - 6, y)
      g.lineTo(x1 - 6, h * 0.8)
      g.stroke()
      for (let x = x0 + 12; x < x1 - 14; x += 14 + r() * 8) {
        g.fillStyle = pal[Math.floor(r() * pal.length)]
        const len = 50 + r() * 50
        g.beginPath()
        g.roundRect(x, y + 4, 12, len, 4)
        g.fill()
      }
    }
    const mannequin = (x: number, dress: string) => {
      g.fillStyle = '#e8ddd4'
      g.beginPath()
      g.arc(x, h * 0.3, 11, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = dress
      g.beginPath()
      g.moveTo(x - 18, h * 0.36)
      g.lineTo(x + 18, h * 0.36)
      g.lineTo(x + 28, h * 0.68)
      g.lineTo(x - 28, h * 0.68)
      g.fill()
      g.fillStyle = '#888'
      g.fillRect(x - 2, h * 0.68, 4, h * 0.1)
    }
    const shelves = (x0: number, x1: number, item: (x: number, y: number) => void) => {
      for (const y of [h * 0.3, h * 0.48, h * 0.66]) {
        g.fillStyle = 'rgba(255,255,255,0.75)'
        g.fillRect(x0, y, x1 - x0, 4)
        for (let x = x0 + 10; x < x1 - 10; x += 22) item(x, y)
      }
    }
    switch (d.facade) {
      case 'spa':
        shelves(30, w - 30, (x, y) => {
          g.fillStyle = ['#9fd8c4', '#ffffff', '#f4d9a8', '#cfe8d0'][Math.floor(r() * 4)]
          g.fillRect(x, y - 22, 12, 22)
          g.fillStyle = '#4fa68e'
          g.fillRect(x + 3, y - 28, 6, 6)
        })
        break
      case 'clinic':
        // a treatment chair, a ring light, a jewellery case
        g.fillStyle = '#ffffff'
        g.beginPath()
        g.roundRect(90, h * 0.45, 140, 40, 12)
        g.fill()
        g.strokeStyle = '#fff'
        g.lineWidth = 8
        g.beginPath()
        g.arc(360, h * 0.38, 40, 0, Math.PI * 2)
        g.stroke()
        g.fillStyle = '#d9c8f2'
        g.fillRect(300, h * 0.62, 160, 40)
        for (let x = 310; x < 450; x += 18) {
          g.fillStyle = '#ffd56a'
          g.beginPath()
          g.arc(x, h * 0.64, 4, 0, Math.PI * 2)
          g.fill()
        }
        break
      case 'salon':
        for (const x of [90, 256, 420]) {
          g.fillStyle = '#ffffff'
          g.beginPath()
          g.ellipse(x, h * 0.4, 42, 56, 0, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#ffe6c4'
          for (let a = 0; a < 10; a++) {
            g.beginPath()
            g.arc(x + Math.cos((a / 10) * Math.PI * 2) * 52, h * 0.4 + Math.sin((a / 10) * Math.PI * 2) * 66, 4, 0, Math.PI * 2)
            g.fill()
          }
        }
        break
      case 'cinema':
        for (const x of [40, 190, 340]) {
          g.fillStyle = '#d9b35b'
          g.fillRect(x, 40, 120, 160)
          g.fillStyle = ['#1f4fa8', '#b3121b', '#6a3fb0'][Math.floor(r() * 3)]
          g.fillRect(x + 8, 48, 104, 144)
          g.fillStyle = '#fff'
          g.font = '800 18px system-ui'
          g.fillText('NOW SHOWING', x + 10, 180)
        }
        break
      case 'gym':
        shelves(20, 200, (x, y) => {
          g.fillStyle = ['#ffffff', '#2de1c2', '#111', '#ff5a5a'][Math.floor(r() * 4)]
          g.beginPath()
          g.roundRect(x, y - 10, 18, 10, 4)
          g.fill()
        })
        rack(240, 480, h * 0.24)
        break
      default:
        rack(20, 220, h * 0.22)
        mannequin(270, d.frame)
        mannequin(330, d.glow)
        rack(370, 500, h * 0.26)
    }
    if (d.facade === 'glass' || d.facade === 'velvet' || d.facade === 'brick') {
      // a neon accent inside
      g.strokeStyle = d.glow
      g.lineWidth = 4
      g.shadowColor = d.glow
      g.shadowBlur = 20
      g.beginPath()
      g.arc(w / 2, 50, 26, 0, Math.PI * 2)
      g.stroke()
      g.shadowBlur = 0
    }
  })
}

const asphalt = () =>
  paint(
    'asphalt',
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#3a3a3e'
      g.fillRect(0, 0, w, h)
      speckle(g, w, h, 30000, '#000', 0.35, 11)
      speckle(g, w, h, 12000, '#9a9aa0', 0.25, 12)
    },
    [40, 2],
  )
const paving = () =>
  paint(
    'paving',
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#b8aea2'
      g.fillRect(0, 0, w, h)
      g.strokeStyle = '#8e857a'
      g.lineWidth = 3
      for (let y = 0; y <= h; y += 64) {
        g.beginPath()
        g.moveTo(0, y)
        g.lineTo(w, y)
        g.stroke()
      }
      for (let x = 0; x <= w; x += 64) {
        g.beginPath()
        g.moveTo(x, 0)
        g.lineTo(x, h)
        g.stroke()
      }
      speckle(g, w, h, 4000, '#000', 0.12, 13)
    },
    [60, 3],
  )
const skylineWindows = (hue: string) =>
  paint(
    `sky:${hue}`,
    256,
    512,
    (g, w, h) => {
      g.fillStyle = hue
      g.fillRect(0, 0, w, h)
      const r = rnd(hue.charCodeAt(1) * 7)
      for (let y = 16; y < h; y += 28)
        for (let x = 12; x < w - 12; x += 26) {
          g.fillStyle = r() < 0.35 ? 'rgba(255,214,150,0.85)' : 'rgba(30,36,50,0.75)'
          g.fillRect(x, y, 16, 18)
        }
    },
    [1, 1],
  )

/* ------------------------------------------------------------------ a building */

/** A soft round glow (white centre fading out) for the active store's aura. */
const aura = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(64, 64, 8, 64, 64, 64)
  r.addColorStop(0, 'rgba(255,255,255,0.8)')
  r.addColorStop(0.55, 'rgba(255,255,255,0.4)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 128, 128)
  return new CanvasTexture(c)
})()

export function useFontsTick() {
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && setN((k) => k + 1))
    return () => {
      live = false
    }
  }, [])
  return n
}

/** A striped fabric awning over the shopfront. */
function Awning({ w, c1, c2, y }: { w: number; c1: string; c2: string; y: number }) {
  const tex = useMemo(() => {
    const t = paint(`awning:${c1}:${c2}`, 256, 64, (g, W, H) => {
      for (let x = 0; x < W; x += 32) {
        g.fillStyle = (x / 32) % 2 ? c2 : c1
        g.fillRect(x, 0, 32, H)
      }
    }).clone()
    t.wrapS = RepeatWrapping
    t.repeat.set(w * 2, 1)
    t.needsUpdate = true
    return t
  }, [c1, c2, w])
  return (
    <group position={[0, y, 0.55]}>
      <mesh rotation={[0.55, 0, 0]}>
        <planeGeometry args={[w, 1.1]} />
        <meshStandardMaterial map={tex} roughness={0.9} side={2} />
      </mesh>
      <mesh position={[0, -0.47, 0.27]}>
        <boxGeometry args={[w, 0.18, 0.02]} />
        <meshStandardMaterial map={tex} roughness={0.9} />
      </mesh>
    </group>
  )
}

function Bulbs({ w, y, n }: { w: number; y: number; n: number }) {
  return (
    <group position={[0, y, 0.09]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} position={[-w / 2 + (w * (i + 0.5)) / n, 0, 0]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshBasicMaterial color="#ffe6b0" toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function Planter({ x, z = 0.45, tall = false }: { x: number; z?: number; tall?: boolean }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.6} />
      </mesh>
      <mesh position={[0, tall ? 0.95 : 0.7, 0]} scale={tall ? [0.35, 0.75, 0.35] : [0.38, 0.32, 0.38]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#3d6b35" roughness={0.9} flatShading />
      </mesh>
    </group>
  )
}

/** A triangular prism (a gable): base w wide, h tall, d deep, ridge parallel to the front. */
function prism(w: number, h: number, d: number, top = 0) {
  const sh = new Shape()
  sh.moveTo(-w / 2, 0)
  sh.lineTo(w / 2, 0)
  if (top > 0) {
    // a trapezoid (a mansard): a flat top `top` wide
    sh.lineTo(top / 2, h)
    sh.lineTo(-top / 2, h)
  } else sh.lineTo(0, h)
  sh.closePath()
  return new ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2)
}

/**
 * Each store's own roofline, so no two buildings share a silhouette: a sawtooth factory roof and a
 * water tower (rock), a gable (boutique), a mansard with round dormers (velvet), a cantilevered
 * glass box (gym), an arched parapet (salon), stepped art-deco gold (glam), deep eaves (heritage),
 * a glass dome (spa), a classical pediment (clinic), a gable and chimney (thrift), a neon heart
 * (lingerie), a cinema blade sign.
 */
const prisms = new Map<string, ExtrudeGeometry>()
const prismC = (w: number, h: number, d: number, top = 0) => {
  const k = `${w}:${h}:${d}:${top}`
  let g = prisms.get(k)
  if (!g) prisms.set(k, (g = prism(w, h, d, top)))
  return g
}

function Crown({ d, W, H, trim }: { d: DoorDef; W: number; H: number; trim: string }) {
  const y = H + 0.14
  const mat = (color: string, rough = 0.7, metal = 0, emissive?: string) => (
    <meshStandardMaterial color={color} roughness={rough} metalness={metal} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 0.9 : 0} />
  )
  switch (d.facade) {
    case 'brick':
      return (
        <group position={[0, y, -1.5]}>
          {[-1, 0, 1].map((k) => (
            <mesh key={k} geometry={prismC(W, 0.75, 0.95)} position={[0, 0, k * 0.98]}>
              {mat('#3a3a40', 0.6, 0.4)}
            </mesh>
          ))}
          {/* the water tower */}
          <group position={[W / 2 - 0.6, 0.9, 0]}>
            <mesh position={[0, 0.55, 0]}>
              <cylinderGeometry args={[0.42, 0.42, 0.9, 16]} />
              {mat('#7a4a32', 0.85)}
            </mesh>
            <mesh position={[0, 1.12, 0]}>
              <coneGeometry args={[0.48, 0.3, 16]} />
              {mat('#3a3a40', 0.6, 0.4)}
            </mesh>
            {[-0.3, 0.3].map((x) => (
              <mesh key={x} position={[x, -0.15, 0]}>
                <boxGeometry args={[0.05, 0.6, 0.05]} />
                {mat('#1e1e22', 0.5, 0.6)}
              </mesh>
            ))}
          </group>
        </group>
      )
    case 'boutique':
      return (
        <mesh geometry={prismC(W + 0.3, 1.25, 3.2)} position={[0, y - 0.08, -1.5]}>
          {mat('#c96f4a', 0.8)}
        </mesh>
      )
    case 'velvet':
      return (
        <group position={[0, y - 0.08, -1.5]}>
          <mesh geometry={prismC(W + 0.2, 1.1, 3.1, W - 0.7)}>{mat('#3b3442', 0.6, 0.2)}</mesh>
          {[-W / 4, W / 4].map((x) => (
            <group key={x} position={[x, 0.5, 1.56 - 0.28]} rotation={[-0.42, 0, 0]}>
              <mesh>
                <circleGeometry args={[0.28, 24]} />
                {mat(trim, 0.5)}
              </mesh>
              <mesh position={[0, 0, 0.01]}>
                <circleGeometry args={[0.2, 24]} />
                <meshStandardMaterial color="#ffd6e2" emissive="#ff8fb1" emissiveIntensity={0.7} />
              </mesh>
            </group>
          ))}
        </group>
      )
    case 'gym':
      return (
        <group position={[0.35, y + 0.55, -1.2]}>
          <mesh>
            <boxGeometry args={[W + 0.7, 1.1, 3.6]} />
            <meshStandardMaterial color="#2a3a52" roughness={0.12} metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.57, 1.81]}>
            <boxGeometry args={[W + 0.72, 0.06, 0.04]} />
            <meshBasicMaterial color="#2de1c2" toneMapped={false} />
          </mesh>
        </group>
      )
    case 'salon':
      return (
        <mesh position={[0, y - 0.1, 0.02]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[W / 2, W / 2, 0.3, 32, 1, false, -Math.PI / 2, Math.PI]} />
          <meshStandardMaterial color="#f3b7cf" roughness={0.6} side={DoubleSide} />
        </mesh>
      )
    case 'gold':
      return (
        <group position={[0, y, -1.2]}>
          {[0, 1, 2].map((k) => (
            <mesh key={k} position={[0, 0.25 + k * 0.5, 0]}>
              <boxGeometry args={[W * (0.86 - k * 0.24), 0.5, 2.2 - k * 0.5]} />
              {mat(k % 2 ? '#1a1a14' : '#d9b35b', 0.3, 0.8)}
            </mesh>
          ))}
          <mesh position={[0, 2.0, 0]}>
            <coneGeometry args={[0.12, 1.0, 8]} />
            <meshStandardMaterial color="#ffe08a" metalness={0.9} roughness={0.2} emissive="#ffcf6a" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )
    case 'heritage':
      return (
        <mesh geometry={prismC(W + 0.9, 1.5, 3.9)} position={[0, y - 0.12, -1.4]}>
          {mat('#9a3a1e', 0.85)}
        </mesh>
      )
    case 'spa':
      return (
        <group position={[0, y - 0.08, -1.5]}>
          <mesh>
            <sphereGeometry args={[Math.min(W, 3) * 0.42, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#bfeee6" roughness={0.08} metalness={0.3} transparent opacity={0.85} />
          </mesh>
          <mesh position={[0, Math.min(W, 3) * 0.42 + 0.12, 0]}>
            <sphereGeometry args={[0.1, 12, 8]} />
            <meshStandardMaterial color="#7ff2e0" emissive="#7ff2e0" emissiveIntensity={1} />
          </mesh>
        </group>
      )
    case 'clinic':
      return (
        <group position={[0, y - 0.08, 0]}>
          <mesh position={[0, 0.12, 0.05]}>
            <boxGeometry args={[W + 0.3, 0.24, 0.4]} />
            {mat('#f7f6fb', 0.45)}
          </mesh>
          <mesh geometry={prismC(W + 0.3, 0.8, 0.4)} position={[0, 0.24, 0.05]}>
            {mat('#f7f6fb', 0.45)}
          </mesh>
        </group>
      )
    case 'thrift':
      return (
        <group position={[0, y - 0.08, -1.5]}>
          <mesh geometry={prismC(W + 0.35, 1.05, 3.2)}>{mat('#5a4636', 0.9)}</mesh>
          <mesh position={[W / 2 - 0.55, 0.95, -0.3]}>
            <boxGeometry args={[0.36, 1.0, 0.36]} />
            {mat('#8a4a32', 0.9)}
          </mesh>
        </group>
      )
    case 'glass':
      return (
        <group position={[0, y + 0.55, 0.05]}>
          {/* a neon heart on the parapet */}
          {[-1, 1].map((sx) => (
            <mesh key={sx} position={[sx * 0.17, 0.12, 0]}>
              <torusGeometry args={[0.2, 0.03, 8, 24]} />
              <meshBasicMaterial color="#ff4fa3" toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0, -0.12, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.36, 0.36, 0.04]} />
            <meshBasicMaterial color="#ff4fa3" toneMapped={false} />
          </mesh>
        </group>
      )
    case 'cinema':
      return (
        <group position={[W / 2 - 0.3, H - 1.2, 0.5]}>
          {/* the vertical blade sign */}
          <mesh>
            <boxGeometry args={[0.18, 3.0, 0.9]} />
            {mat('#b3121b', 0.5, 0.2)}
          </mesh>
          {Array.from({ length: 8 }, (_, k) => (
            <mesh key={k} position={[0.1, -1.3 + k * 0.37, 0]}>
              <sphereGeometry args={[0.05, 8, 6]} />
              <meshBasicMaterial color="#ffe2a8" toneMapped={false} />
            </mesh>
          ))}
        </group>
      )
  }
  return null
}

function Building({ d, i, count, onEnter }: { d: DoorDef; i: number; count: number; onEnter: (id: DoorId) => void }) {
  const fonts = useFontsTick()
  const hovered = useHub((s) => s.hovered === d.id)
  const entering = useHub((s) => s.entering?.id === d.id)
  const W = d.width
  const H = 3.2 + (d.floors - 1) * 2.9
  const wall = useMemo(() => {
    const t = wallTexture(d.facade, d.door).clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(W / 2.2, H / 2.2)
    t.needsUpdate = true
    return t
  }, [d.facade, d.door, W, H])
  const sign = useMemo(() => signTexture(d, fonts), [d, fonts])
  const inside = useMemo(() => interiorTexture(d), [d])
  const glow = useMemo(() => new Color(d.glow), [d.glow])
  const signMat = useRef<MeshStandardMaterial>(null)
  const light = useRef<PointLight>(null)
  const door = useRef<Group>(null)
  const halos = useRef<(MeshBasicMaterial | null)[]>([])
  const pool = useRef<MeshBasicMaterial>(null)
  const body = useRef<Group>(null)
  useFrame(({ clock }, dt) => {
    const on = hovered || entering ? 1 : 0
    const k = 1 - Math.exp(-dt * 8)
    // the active store glows unmistakably: a pulsing neon outline, a blazing sign, light spilling
    // onto the pavement, and the whole front stepping forward a touch
    const pulse = 0.8 + Math.sin(clock.elapsedTime * 4) * 0.2
    if (signMat.current) signMat.current.emissiveIntensity = MathUtils.lerp(signMat.current.emissiveIntensity, 0.55 + on * 1.8, k)
    if (light.current) light.current.intensity = MathUtils.lerp(light.current.intensity, 1.5 + on * 16, k)
    for (const h of halos.current) if (h) h.opacity = MathUtils.lerp(h.opacity, on * pulse, k)
    if (pool.current) pool.current.opacity = MathUtils.lerp(pool.current.opacity, 0.1 + on * 0.5, k)
    if (body.current) body.current.scale.setScalar(MathUtils.lerp(body.current.scale.x, 1 + on * 0.035, k))
    if (door.current) {
      const t = useHub.getState().entering
      const open = entering && t ? Math.min(1, t.t * 1.8) : 0
      door.current.rotation.y = MathUtils.lerp(door.current.rotation.y, -open * 1.5, 1 - Math.exp(-dt * 10))
    }
  })
  const enter = () => {
    if (useHub.getState().entering) return
    useHub.setState({ x: LAYOUT[i] })
    click('go')
    sfx('door')
    haptic(20)
    useHub.setState({ hovered: d.id, entering: { id: d.id, t: 0 } })
    onEnter(d.id)
  }
  const pointer = {
    onPointerOver: (e: { stopPropagation: () => void }) => (e.stopPropagation(), useHub.getState().setHovered(d.id), (document.body.style.cursor = 'pointer')),
    onPointerOut: () => (useHub.getState().setHovered(null), (document.body.style.cursor = '')),
    onClick: (e: { stopPropagation: () => void }) => (e.stopPropagation(), enter()),
  }
  const doorW = doorWidth(d)
  const doorX = doorOffset(d)
  const winW = d.facade === 'gym' || d.facade === 'glass' ? W - doorW - 0.9 : (W - doorW - 1.0) / 2
  const trim = d.facade === 'gold' ? '#d9b35b' : d.facade === 'brick' ? '#1a1a1c' : d.frame
  const wood = d.facade === 'heritage' || d.facade === 'thrift'
  const extras: ReactNode[] = []
  switch (d.facade) {
    case 'boutique':
      extras.push(<Awning key="aw" w={W - 0.3} c1="#f2c14e" c2="#fbf6ec" y={2.78} />, <Planter key="p1" x={-W / 2 + 0.4} />, <Planter key="p2" x={W / 2 - 0.4} />)
      break
    case 'thrift':
      extras.push(
        <Awning key="aw" w={W - 0.3} c1="#2e5a3a" c2="#efe2c4" y={2.78} />,
        // a chalkboard A-frame on the pavement
        <mesh key="ab" position={[W / 2 - 0.45, 0.45, 0.9]} rotation={[-0.15, -0.3, 0]}>
          <boxGeometry args={[0.5, 0.8, 0.04]} />
          <meshStandardMaterial color="#1e2a22" roughness={0.9} />
        </mesh>,
      )
      break
    case 'velvet':
      extras.push(<Awning key="aw" w={W - 0.3} c1="#b0124a" c2="#f2d4dc" y={2.78} />)
      break
    case 'salon':
      extras.push(<Bulbs key="b" w={W - 0.4} y={2.42} n={14} />, <Awning key="aw" w={W - 0.3} c1="#2a1720" c2="#ff9bc8" y={2.78} />)
      break
    case 'cinema':
      extras.push(
        // the marquee canopy, ringed with bulbs
        <mesh key="mq" position={[0, 2.78, 0.55]}>
          <boxGeometry args={[W + 0.2, 0.5, 1.1]} />
          <meshStandardMaterial color="#b3121b" roughness={0.5} metalness={0.2} />
        </mesh>,
        <group key="mb" position={[0, 2.55, 1.11]}>
          <Bulbs w={W + 0.1} y={0} n={22} />
          <Bulbs w={W + 0.1} y={0.46} n={22} />
        </group>,
      )
      break
    case 'clinic':
      extras.push(
        ...[-W / 2 + 0.22, W / 2 - 0.22].map((x) => (
          <mesh key={`c${x}`} position={[x, 1.6, 0.25]}>
            <cylinderGeometry args={[0.13, 0.15, 3.2, 20]} />
            <meshStandardMaterial color="#f7f6fb" roughness={0.4} />
          </mesh>
        )),
        <Planter key="p1" x={-doorW / 2 - 0.45} tall />,
        <Planter key="p2" x={doorW / 2 + 0.45} tall />,
      )
      break
    case 'spa':
      extras.push(
        ...Array.from({ length: 9 }, (_, k) => (
          <mesh key={`bb${k}`} position={[-W / 2 + 0.1 + k * 0.05, 1.2 + (k % 3) * 0.2, 0.3]}>
            <cylinderGeometry args={[0.02, 0.025, 2.4 + (k % 3) * 0.4, 8]} />
            <meshStandardMaterial color="#8ab07a" roughness={0.6} />
          </mesh>
        )),
        <Planter key="p2" x={W / 2 - 0.4} tall />,
      )
      break
    case 'heritage':
      extras.push(
        // a carved wooden canopy on two posts
        <mesh key="cn" position={[0, 3.1, 0.6]}>
          <boxGeometry args={[W - 0.2, 0.16, 1.25]} />
          <meshStandardMaterial color="#5a2e14" roughness={0.7} />
        </mesh>,
        ...[-W / 2 + 0.25, W / 2 - 0.25].map((x) => (
          <mesh key={`po${x}`} position={[x, 1.55, 1.1]}>
            <boxGeometry args={[0.14, 3.1, 0.14]} />
            <meshStandardMaterial color="#5a2e14" roughness={0.7} />
          </mesh>
        )),
      )
      break
    case 'gold':
      extras.push(
        ...[-W / 2 + 0.3, W / 2 - 0.3].map((x) => (
          <group key={`l${x}`} position={[x, 2.2, 0.25]}>
            <mesh>
              <boxGeometry args={[0.18, 0.32, 0.18]} />
              <meshStandardMaterial color="#d9b35b" metalness={0.9} roughness={0.25} emissive="#ffcf6a" emissiveIntensity={0.6} />
            </mesh>
          </group>
        )),
      )
      break
    case 'brick':
      extras.push(
        // a half-raised steel shutter over the window (in front of the glass: never on its plane)
        <mesh key="sh" position={[-W / 2 + 0.5 + winW / 2, 2.38, 0.13]}>
          <boxGeometry args={[winW + 0.1, 0.45, 0.06]} />
          <meshStandardMaterial color="#6e6e74" metalness={0.7} roughness={0.45} />
        </mesh>,
      )
      break
    case 'gym':
      extras.push(
        <mesh key="st" position={[-W / 2 + 0.05, H / 2, 0.08]}>
          <boxGeometry args={[0.1, H, 0.12]} />
          <meshStandardMaterial color="#2de1c2" emissive="#2de1c2" emissiveIntensity={0.8} />
        </mesh>,
      )
      break
    case 'glass':
      extras.push(
        // a pink neon frame round the windows
        <mesh key="nf" position={[-doorW / 2 - 0.15, 1.45, 0.07]}>
          <boxGeometry args={[winW + 0.12, 0.04, 0.03]} />
          <meshBasicMaterial color="#ff4fa3" toneMapped={false} />
        </mesh>,
      )
      break
  }
  const winY = 1.45
  const winH = 2.1
  const at = arc(LAYOUT[i], KERB, FRONT)
  return (
    <group position={at.position} rotation={at.rotation}>
      <group ref={body}>
        {/* the active store's neon outline: round the whole front, roof to pavement */}
        <group position={[0, 0, 0.16]}>
          {(
            [
              [0, H + 0.25, W + 0.4, 0.14],
              [-W / 2 - 0.2, (H + 0.25) / 2, 0.14, H + 0.25],
              [W / 2 + 0.2, (H + 0.25) / 2, 0.14, H + 0.25],
            ] as [number, number, number, number][]
          ).map(([x, y, w, h], k) => (
            <mesh key={k} position={[x, y, 0]}>
              <planeGeometry args={[w, h]} />
              <meshBasicMaterial ref={(m) => void (halos.current[k] = m)} color={d.glow} transparent opacity={0} toneMapped={false} depthWrite={false} />
            </mesh>
          ))}
        </group>
        {/* and a big soft aura of the store's colour behind the whole building */}
        <mesh position={[0, H / 2 + 0.4, -3.3]}>
          <planeGeometry args={[W + 4.5, H + 4.5]} />
          <meshBasicMaterial ref={(m) => void (halos.current[3] = m)} color={d.glow} map={aura} transparent opacity={0} toneMapped={false} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
        <Crown d={d} W={W} H={H} trim={trim} />
        {/* the building's mass and its wall finish */}
        <mesh position={[0, H / 2, -1.5]}>
          <boxGeometry args={[W, H, 3]} />
          <meshStandardMaterial map={wall} roughness={d.facade === 'glass' || d.facade === 'gold' ? 0.25 : 0.85} metalness={d.facade === 'glass' ? 0.3 : 0} />
        </mesh>
        {/* cornice and parapet */}
        <mesh position={[0, H + 0.06, 0.05]}>
          <boxGeometry args={[W + 0.12, 0.16, 0.22]} />
          <meshStandardMaterial color={trim} roughness={0.5} metalness={d.facade === 'gold' ? 0.8 : 0.1} />
        </mesh>
        {/* upper floors: windows with frames, sills and warm light behind */}
        {Array.from({ length: d.floors - 1 }, (_, f) =>
          Array.from({ length: Math.max(2, Math.round(W / 1.2)) }, (__, k) => {
            const n = Math.max(2, Math.round(W / 1.2))
            const x = -W / 2 + (W * (k + 0.5)) / n
            const y = 3.2 + f * 2.9 + 1.4
            return (
              <group key={`${f}:${k}`} position={[x, y, 0.01]}>
                <mesh>
                  <boxGeometry args={[0.78, 1.3, 0.06]} />
                  <meshStandardMaterial color={trim} roughness={0.5} />
                </mesh>
                <mesh position={[0, 0, 0.035]}>
                  <planeGeometry args={[0.66, 1.18]} />
                  <meshStandardMaterial color={(f + k) % 3 ? '#9cbfe0' : '#ffe2b0'} emissive={(f + k) % 3 ? '#3a5a80' : '#ffb860'} emissiveIntensity={(f + k) % 3 ? 0.35 : 0.55} roughness={0.12} metalness={0.25} />
                </mesh>
                <mesh position={[0, -0.7, 0.07]}>
                  <boxGeometry args={[0.86, 0.06, 0.14]} />
                  <meshStandardMaterial color={shade(trim, 0.1)} roughness={0.6} />
                </mesh>
              </group>
            )
          }),
        )}
        {/* the fascia sign */}
        <mesh position={[0, 3.55, 0.06]}>
          <planeGeometry args={[W - 0.3, (W - 0.3) / 4]} />
          <meshStandardMaterial ref={signMat} map={sign} emissiveMap={sign} emissive="#ffffff" emissiveIntensity={0.55} roughness={0.5} toneMapped={false} />
        </mesh>
        {/* shopfront: pilasters, display windows with the store inside, the door */}
        {[-W / 2 + 0.12, W / 2 - 0.12].map((x) => (
          <mesh key={x} position={[x, 1.6, 0.06]}>
            <boxGeometry args={[0.24, 3.2, 0.14]} />
            <meshStandardMaterial color={trim} roughness={0.5} metalness={d.facade === 'gold' ? 0.8 : 0.1} />
          </mesh>
        ))}
        {(d.facade === 'gym' || d.facade === 'glass' ? [-W / 2 + 0.3 + winW / 2] : [-W / 2 + 0.4 + winW / 2, W / 2 - 0.4 - winW / 2]).map((x, k) => (
          <group key={`w${k}`} position={[x, winY, 0]} {...pointer}>
            <mesh position={[0, 0, 0.006]}>
              <planeGeometry args={[winW, winH]} />
              <meshBasicMaterial map={inside} toneMapped={false} />
            </mesh>
            {/* glass with a soft sky reflection */}
            <mesh position={[0, 0, 0.03]}>
              <planeGeometry args={[winW, winH]} />
              <meshStandardMaterial color="#a8c4e0" transparent opacity={0.16} roughness={0.05} metalness={0.9} depthWrite={false} />
            </mesh>
            <mesh position={[0, -winH / 2 - 0.12, 0.04]}>
              <boxGeometry args={[winW + 0.1, 0.24, 0.12]} />
              <meshStandardMaterial color={trim} roughness={0.5} />
            </mesh>
            <mesh position={[0, winH / 2 + 0.03, 0.04]}>
              <boxGeometry args={[winW + 0.1, 0.06, 0.1]} />
              <meshStandardMaterial color={trim} roughness={0.5} />
            </mesh>
          </group>
        ))}
        {/* the door: light spills out of the opening behind it */}
        <group position={[doorX, 0, 0]}>
          <mesh position={[0, 1.18, 0.006]}>
            <planeGeometry args={[doorW, 2.36]} />
            <meshBasicMaterial color={d.glow} toneMapped={false} />
          </mesh>
          <mesh position={[0, 2.44, 0.03]}>
            <boxGeometry args={[doorW + 0.16, 0.12, 0.12]} />
            <meshStandardMaterial color={trim} roughness={0.5} />
          </mesh>
          <group ref={door} position={[-doorW / 2, 0, 0.04]} {...pointer}>
            <mesh position={[doorW / 2, 1.18, 0]}>
              <boxGeometry args={[doorW, 2.36, 0.05]} />
              <meshStandardMaterial color={wood ? '#5a3418' : '#9fb8d0'} transparent={!wood} opacity={wood ? 1 : 0.35} roughness={wood ? 0.6 : 0.05} metalness={wood ? 0 : 0.6} />
            </mesh>
            {/* a brass handle */}
            <mesh position={[doorW - 0.12, 1.05, 0.06]}>
              <boxGeometry args={[0.03, 0.4, 0.03]} />
              <meshStandardMaterial color="#d9b35b" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
          <pointLight ref={light} position={[0, 2.6, 1.0]} color={glow} intensity={1.5} distance={6} decay={2} />
          {/* step */}
          <mesh position={[0, 0.04, 0.25]}>
            <boxGeometry args={[doorW + 0.4, 0.08, 0.5]} />
            <meshStandardMaterial color="#9a938a" roughness={0.8} />
          </mesh>
          {count > 0 && (
            <Html position={[0, 2.85, 0.4]} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <div className="flex items-center gap-1.5 whitespace-nowrap rounded-full bg-black/70 px-3 py-1 text-[14px] font-extrabold text-white shadow-lg" aria-label={`People already here: ${count}`}>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                  <path d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M15.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M2.5 20a6 6 0 0 1 12 0 M12 16a6 6 0 0 1 9.5 4" />
                </svg>
                People already here
              </div>
            </Html>
          )}
        </group>
        {/* a pool of the store's light on the pavement */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[doorX, 0.015, 1.1]}>
          <circleGeometry args={[1.5, 32]} />
          <meshBasicMaterial ref={pool} color={d.glow} transparent opacity={0.1} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
        {extras}
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ the street */

function Lamppost({ x, z, flip = false }: { x: number; z: number; flip?: boolean }) {
  const s = flip ? -1 : 1
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 2.1, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 4.2, 10]} />
        <meshStandardMaterial color="#1e2226" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.15, s * 0.35]} rotation={[(s * Math.PI) / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.7, 8]} />
        <meshStandardMaterial color="#1e2226" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.05, s * 0.7]}>
        <cylinderGeometry args={[0.16, 0.22, 0.18, 12]} />
        <meshStandardMaterial color="#1e2226" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.95, s * 0.7]}>
        <sphereGeometry args={[0.1, 12, 8]} />
        <meshBasicMaterial color="#ffe2a8" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.9, 0.06, 0.9]} />
        <meshStandardMaterial color="#5a4a38" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 1.8, 8]} />
        <meshStandardMaterial color="#5a4030" roughness={0.9} />
      </mesh>
      {/* a young street tree: its crown stays under the shop signs */}
      {[
        [0, 2.15, 0, 0.5],
        [0.28, 1.95, 0.12, 0.36],
        [-0.26, 2.0, -0.1, 0.38],
        [0.05, 2.5, -0.05, 0.34],
      ].map(([px, py, pz, r], k) => (
        <mesh key={k} position={[px, py, pz]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={k % 2 ? '#4f7a3a' : '#3f6a32'} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** A car driving round the curve now and then (the street is alive). */
function Traffic() {
  const car = useRef<Group>(null)
  const color = useMemo(() => new Color('#c8102e'), [])
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 16) / 16
    if (!car.current) return
    car.current.visible = t < 0.55
    const x = X_MAX + 12 - (t / 0.55) * (X_MAX - X_MIN + 24)
    const at = arc(x, 0, -2.2)
    car.current.position.set(...at.position)
    car.current.rotation.set(...at.rotation)
  })
  return (
    <group ref={car}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[4.2, 0.6, 1.75]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.2, 1.0, 0]}>
        <boxGeometry args={[2.2, 0.5, 1.6]} />
        <meshStandardMaterial color="#3a5070" metalness={0.6} roughness={0.12} />
      </mesh>
      {[-1.4, 1.4].map((x) =>
        [-0.8, 0.8].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.32, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 0.22, 16]} />
            <meshStandardMaterial color="#141414" roughness={0.8} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** Golden-hour sky: warm at the horizon, blue overhead, a soft sun glow; light haze. Never night. */
function Sky() {
  return (
    <mesh scale={160} position={[0, 0, 0]}>
      <sphereGeometry args={[1, 48, 24]} />
      <shaderMaterial
        side={1}
        depthWrite={false}
        vertexShader={'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'}
        fragmentShader={
          'varying vec3 vP; void main(){ float h = vP.y; vec3 zen = vec3(0.36,0.6,0.92); vec3 hor = vec3(1.0,0.78,0.56); vec3 low = vec3(0.96,0.7,0.6); vec3 c = mix(hor, zen, smoothstep(0.0, 0.55, h)); c = mix(low, c, smoothstep(-0.1, 0.05, h)); vec3 sd = normalize(vec3(0.55, 0.16, -0.83)); float s = max(dot(vP, sd), 0.0); c += vec3(1.0,0.8,0.52) * (pow(s, 14.0) * 0.5 + pow(s, 400.0) * 1.5); gl_FragColor = vec4(c, 1.0); }'
        }
      />
    </mesh>
  )
}

/** A flat ring band laid on the ground at height y. */
function Band({ d0, d1, y, children }: { d0: number; d1: number; y: number; children: ReactNode }) {
  const g = useMemo(() => band(d0, d1), [d0, d1])
  return (
    <mesh geometry={g} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      {children}
    </mesh>
  )
}

function Street() {
  const road = useMemo(() => asphalt(), [])
  const pave = useMemo(() => paving(), [])
  const skyline = useMemo(() => {
    const r = rnd(42)
    return Array.from({ length: 20 }, (_, k) => ({ x: X_MIN - 9 + k * ((X_MAX - X_MIN + 18) / 19), h: 9 + r() * 16, w: 5 + r() * 4, z: -15 - r() * 8, hue: ['#7d8aa3', '#8f8a99', '#a39088', '#6e7d96'][k % 4] }))
  }, [])
  // distances out from the shopfronts (towards the plaza) of each strip of the street
  const kerbs = useMemo(() => [2.55, 7.45].map((dd) => new CylinderGeometry(R - dd, R - dd, 0.14, 160, 1, true, Math.PI - (X_MAX + 8) / R, (X_MAX - X_MIN + 16) / R)), [])
  return (
    <group>
      <Sky />
      <fog attach="fog" args={['#f2c8a8', 30, 95]} />
      <hemisphereLight args={['#ffe6cc', '#8a7a6a', 1.35]} />
      <ambientLight intensity={0.4} color="#fff1e0" />
      {/* the low sun over the plaza: warm light on the shopfronts */}
      <directionalLight position={[0, 9, 16]} intensity={2.6} color="#ffd2a0" />
      <directionalLight position={[12, 6, -4]} intensity={0.5} color="#9ec2ff" />
      {/* the far pavement, the road, the near pavement and the plaza, all following the curve */}
      <Band d0={-0.1} d1={2.55} y={KERB}>
        <meshStandardMaterial map={pave} roughness={0.85} />
      </Band>
      <Band d0={2.55} d1={7.45} y={0}>
        <meshStandardMaterial map={road} roughness={0.92} />
      </Band>
      <Band d0={7.45} d1={R - 0.02} y={KERB}>
        <meshStandardMaterial map={pave} roughness={0.85} />
      </Band>
      <Band d0={-9} d1={-0.1} y={KERB - 0.01}>
        <meshStandardMaterial color="#8e857a" roughness={0.9} />
      </Band>
      {kerbs.map((g, k) => (
        <mesh key={k} geometry={g} position={[0, 0.07, 0]}>
          <meshStandardMaterial color="#a8a196" roughness={0.8} side={DoubleSide} />
        </mesh>
      ))}
      {/* lane dashes */}
      {Array.from({ length: Math.ceil((X_MAX - X_MIN + 14) / 3) }, (_, k) => {
        const at = arc(X_MIN - 7 + k * 3, 0.006, FRONT + 5)
        return (
          <mesh key={k} position={at.position} rotation={[-Math.PI / 2, 0, at.rotation[1]]}>
            <planeGeometry args={[1.4, 0.12]} />
            <meshStandardMaterial color="#f2efe6" roughness={0.6} />
          </mesh>
        )
      })}
      {/* lamps and trees stand at the party walls, never in front of a sign or a door */}
      {LAYOUT.slice(0, -1).map((x, k) => {
        const gap = (x + DOORS[k].width / 2 + LAYOUT[k + 1] - DOORS[k + 1].width / 2) / 2
        // only on the shops' side: nothing stands between the view and the stores
        const far = arc(gap, 0, k % 2 ? -4.2 : -3.75)
        return (
          <group key={k} position={far.position} rotation={far.rotation}>
            {k % 2 ? <Tree x={0} z={0} /> : <Lamppost x={0} z={0} />}
          </group>
        )
      })}
      {/* the city behind, round the curve */}
      {skyline.map((b, k) => {
        const at = arc(b.x, b.h / 2, b.z)
        return (
          <mesh key={k} position={at.position} rotation={at.rotation}>
            <boxGeometry args={[b.w, b.h, 4]} />
            <meshStandardMaterial map={skylineWindows(b.hue)} roughness={0.8} />
          </mesh>
        )
      })}
      <Traffic />
    </group>
  )
}

/**
 * Drives the camera: a raised, map-like view from the plaza, turning along the curve to the active
 * store (several stores and the sweep of the street in view), and the walk across into a store.
 */
function HubCamera({ onWalked }: { onWalked: (id: DoorId) => void }) {
  const get = useThree((s) => s.get)
  const size = useThree((s) => s.size)
  const x = useRef(useHub.getState().x)
  const done = useRef<DoorId | null>(null)
  useEffect(() => {
    const cam = get().camera as PerspectiveCamera
    cam.fov = 52
    cam.far = 400
    cam.updateProjectionMatrix()
    return () => {
      cam.fov = 30
      cam.far = 120
      cam.updateProjectionMatrix()
    }
  }, [get])
  useFrame(({ clock, camera }, dt) => {
    const s = useHub.getState()
    const wide = size.width / size.height > 1
    // back from the shopfronts and up: further on wide screens, so more of the curve is in view
    let back = wide ? 17 : 13.5
    let up = wide ? 5.2 : 4.4
    let lookY = 2.9
    let tx = s.x
    if (s.entering) {
      const i = DOORS.findIndex((d) => d.id === s.entering!.id)
      const t = Math.min(1, s.entering.t + dt / 1.5)
      useHub.setState({ entering: { ...s.entering, t } })
      const e = t * t * (3 - 2 * t)
      tx = LAYOUT[i] + doorOffset(DOORS[i])
      back = MathUtils.lerp(back, 0.4, e)
      up = MathUtils.lerp(up, EYE, e)
      lookY = MathUtils.lerp(lookY, 1.5, e)
      if (t >= 1 && done.current !== s.entering.id) {
        done.current = s.entering.id
        onWalked(s.entering.id)
      }
    } else {
      done.current = null
      // after a drag or swipe, settle on the nearest store
      if (performance.now() - s.dragAt > 280) tx = LAYOUT[nearest(s.x)]
    }
    x.current = MathUtils.lerp(x.current, tx, 1 - Math.exp(-dt * (s.entering ? 5 : 4)))
    const bob = Math.sin(clock.elapsedTime * 0.6) * 0.01
    const eye = arc(x.current, KERB + up + bob, FRONT + back)
    const at = arc(x.current, KERB + lookY, FRONT)
    camera.position.set(...eye.position)
    camera.lookAt(at.position[0], at.position[1], at.position[2])
  })
  return null
}

export function Hub({ onEnter, onWalked }: { onEnter: (id: DoorId) => void; onWalked: (id: DoorId) => void }) {
  const counts = useRealtime((s) => s.counts)
  const connected = useRealtime((s) => s.status === 'live')
  // keyboard: ← → move store to store, Enter goes in
  useEffect(() => {
    enterHandler = (id) => {
      click('go')
      sfx('door')
      haptic(20)
      useHub.setState({ hovered: id, entering: { id, t: 0 } })
      onEnter(id)
    }
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        lookToDoor(e.key === 'ArrowLeft' ? -1 : 1)
      } else if (e.key === 'Enter' && !(e.target as HTMLElement)?.closest('button, a')) enterActive()
    }
    window.addEventListener('keydown', onKey)
    // arriving on the street: the store in front of you is the active one
    if (!useHub.getState().hovered) useHub.setState({ hovered: DOORS[nearest(useHub.getState().x)].id })
    return () => {
      window.removeEventListener('keydown', onKey)
      enterHandler = null
    }
  }, [onEnter])
  return (
    <group>
      <Street />
      {DOORS.map((d, i) => (
        <Building key={d.id} d={d} i={i} count={connected ? (counts[`door:${d.id}`] ?? 0) : 0} onEnter={onEnter} />
      ))}
      <HubCamera onWalked={onWalked} />
    </group>
  )
}

// dev only: automated street walk-throughs
if (import.meta.env.DEV) Object.assign(window as unknown as Record<string, unknown>, { __dsHub: useHub, __dsHubX: (i: number) => LAYOUT[i] })
