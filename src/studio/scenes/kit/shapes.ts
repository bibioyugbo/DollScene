import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, PlaneGeometry, SphereGeometry, TorusGeometry, Vector3 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { V3 } from '../types'
import { canvasTexture, Parts, range, rng, type Rand } from './core'

/** Lumpy smooth blob (foliage clumps, bushes, popcorn, flowers). ~80 tris at detail 1. */
export function blob(detail = 1, lump = 0.18, seed = 1) {
  const r = rng(seed)
  const g = mergeVertices(new IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'))
  const p = g.attributes.position
  const v = new Vector3()
  const offs = Array.from({ length: 6 }, () => new Vector3(range(r, -1, 1), range(r, -1, 1), range(r, -1, 1)).normalize())
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    let k = 1
    offs.forEach((o, j) => (k += Math.max(0, v.dot(o)) ** 3 * lump * (j % 2 ? 1 : -0.6)))
    v.multiplyScalar(k)
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

/**
 * Recursive branching tree (trunk + limbs as open cylinders). Returns the branch tips so callers
 * can hang foliage clumps there. `twist` bends limbs for spooky silhouettes.
 */
export function addTree(parts: Parts, base: V3, opts: { height: number; seed: number; color: string; depth?: number; spread?: number; twist?: number; radius?: number }) {
  const r = rng(opts.seed)
  const tips: { p: V3; size: number }[] = []
  const depth = opts.depth ?? 4
  const spread = opts.spread ?? 0.75
  const grow = (a: Vector3, dir: Vector3, len: number, rad: number, d: number) => {
    const segs = d === 0 ? 3 : 2
    let p = a.clone()
    const dv = dir.clone()
    for (let s = 0; s < segs; s++) {
      dv.add(new Vector3(range(r, -1, 1), range(r, -0.3, 0.6), range(r, -1, 1)).multiplyScalar(opts.twist ?? 0.18)).normalize()
      const q = p.clone().addScaledVector(dv, len / segs)
      const r0 = rad * (1 - (s / segs) * 0.35)
      const r1 = rad * (1 - ((s + 1) / segs) * 0.35)
      parts.limb([p.x, p.y, p.z], [q.x, q.y, q.z], r0, r1, opts.color, d < 2 ? 7 : 5)
      p = q
    }
    if (d >= depth) {
      tips.push({ p: [p.x, p.y, p.z], size: len })
      return
    }
    const n = d === 0 ? 3 : 2 + (r() < 0.4 ? 1 : 0)
    const base = r() * Math.PI * 2
    for (let i = 0; i < n; i++) {
      const az = base + (i / n) * Math.PI * 2 + range(r, -0.4, 0.4)
      const side = new Vector3(Math.cos(az), 0, Math.sin(az))
      const nd = dv.clone().multiplyScalar(1 - spread * 0.6).addScaledVector(side, spread).normalize()
      grow(p, nd, len * range(r, 0.62, 0.78), rad * 0.62, d + 1)
    }
  }
  const h0 = opts.height * 0.38
  grow(new Vector3(...base), new Vector3(0, 1, 0), h0, opts.radius ?? opts.height * 0.035, 0)
  return tips
}

/** Pinnate frond texture (white, alpha) for palm leaves. */
export function frondTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.strokeStyle = '#fff'
    ctx.lineCap = 'round'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(w / 2, h)
    ctx.lineTo(w / 2, 0)
    ctx.stroke()
    ctx.lineWidth = 5
    for (let y = 6; y < h; y += 9) {
      const t = y / h
      const len = (w / 2) * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.7
      for (const s of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(w / 2, y)
        ctx.lineTo(w / 2 + s * len, y - 14 - t * 10)
        ctx.stroke()
      }
    }
  })
}

/** A single frond blade along +X (length 1), drooping, V-folded; uv.v runs along the blade. */
function frondBlade(droop: number) {
  const g = new PlaneGeometry(1, 1, 8, 2)
  const p = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) + 0.5
    const v = p.getY(i)
    const w = 0.42 * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.04)) ** 0.6
    p.setXYZ(i, u, -droop * u * u - Math.abs(v) * w * 0.35, v * w)
    uv.setXY(i, v + 0.5, u)
  }
  g.computeVertexNormals()
  return g
}

/** Palm tree: curved ringed trunk into `trunk`, fronds (use frondTexture, alphaTest) into `fronds`. */
export function addPalm(trunk: Parts, fronds: Parts, base: V3, opts: { height: number; lean: number; dir: number; seed: number; trunkColor?: string; frondColors?: string[] }) {
  const r = rng(opts.seed)
  const segs = 10
  const pts: Vector3[] = []
  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    const off = opts.lean * t * t * opts.height
    pts.push(new Vector3(base[0] + Math.cos(opts.dir) * off, base[1] + t * opts.height, base[2] + Math.sin(opts.dir) * off))
  }
  for (let i = 0; i < segs; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const rad = 0.14 * (1 - (i / segs) * 0.45)
    trunk.limb([a.x, a.y, a.z], [b.x, b.y, b.z], rad * 1.08, rad * 0.94, i % 2 ? (opts.trunkColor ?? '#7a5e45') : '#6a503a', 8)
  }
  const top = pts[segs]
  trunk.add(new SphereGeometry(0.17, 8, 6), '#5b4a2f', [top.x, top.y, top.z])
  const n = 11
  const cols = opts.frondColors ?? ['#3f7a3a', '#4e8b3c', '#356b33']
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2 + range(r, -0.2, 0.2)
    const len = range(r, 1.5, 2.1) * (opts.height / 6) ** 0.5
    const tilt = range(r, -0.5, 0.25)
    fronds.group([top.x, top.y, top.z], [0, az, tilt], len, () => fronds.add(frondBlade(range(r, 0.5, 0.9)), cols[i % cols.length]))
  }
}

/** Gold chiavari wedding chair facing +Z, origin at the floor. ~400 tris. */
export function chiavariChair(gold = '#c9a24a', cushion = '#f5efe4') {
  const p = new Parts()
  const leg = (x: number, z: number, h: number) => p.add(new CylinderGeometry(0.014, 0.012, h, 6, 1, true), gold, [x, h / 2, z])
  leg(-0.2, 0.2, 0.46)
  leg(0.2, 0.2, 0.46)
  leg(-0.19, -0.19, 0.92)
  leg(0.19, -0.19, 0.92)
  p.add(new BoxGeometry(0.44, 0.05, 0.44), cushion, [0, 0.47, 0.01])
  for (const y of [0.62, 0.74, 0.86]) p.add(new CylinderGeometry(0.01, 0.01, 0.38, 5, 1, true), gold, [0, y, -0.19], [0, 0, Math.PI / 2])
  for (const x of [-0.09, 0, 0.09]) p.add(new CylinderGeometry(0.008, 0.008, 0.36, 5, 1, true), gold, [x, 0.74, -0.19])
  p.add(new CylinderGeometry(0.01, 0.01, 0.38, 5, 1, true), gold, [0, 0.16, 0.2], [0, 0, Math.PI / 2])
  p.add(new CylinderGeometry(0.01, 0.01, 0.38, 5, 1, true), gold, [0, 0.16, -0.19], [0, 0, Math.PI / 2])
  return p.build()
}

/** Victorian park lamp; returns the lamp glass centre (for a glow). */
export function addLampPost(parts: Parts, base: V3, color = '#1d2224', glass = '#ffe3a8'): V3 {
  const [x, y, z] = base
  parts.add(new CylinderGeometry(0.12, 0.16, 0.3, 8), color, [x, y + 0.15, z])
  parts.add(new CylinderGeometry(0.045, 0.06, 2.9, 8, 1, true), color, [x, y + 1.75, z])
  parts.add(new TorusGeometry(0.07, 0.015, 5, 10), color, [x, y + 0.9, z], [Math.PI / 2, 0, 0])
  parts.add(new CylinderGeometry(0.16, 0.08, 0.1, 8), color, [x, y + 3.25, z])
  parts.add(new CylinderGeometry(0.13, 0.1, 0.36, 6, 1, true), glass, [x, y + 3.48, z])
  parts.add(new CylinderGeometry(0.02, 0.2, 0.18, 6), color, [x, y + 3.75, z])
  parts.add(new SphereGeometry(0.04, 6, 4), color, [x, y + 3.86, z])
  return [x, y + 3.48, z]
}

/** Slatted park bench facing +Z, origin at floor centre. */
export function addBench(parts: Parts, wood = '#8a5a34', iron = '#1f2326') {
  for (const sx of [-0.7, 0.7]) {
    parts.add(new BoxGeometry(0.05, 0.42, 0.06), iron, [sx, 0.21, 0.2])
    parts.add(new BoxGeometry(0.05, 0.85, 0.06), iron, [sx, 0.42, -0.2], [-0.12, 0, 0])
    parts.add(new BoxGeometry(0.05, 0.05, 0.48), iron, [sx, 0.42, 0])
    parts.add(new BoxGeometry(0.05, 0.05, 0.4), iron, [sx, 0.62, 0.05])
  }
  for (let i = 0; i < 4; i++) parts.add(new BoxGeometry(1.6, 0.035, 0.09), wood, [0, 0.45, 0.17 - i * 0.11])
  for (let i = 0; i < 3; i++) parts.add(new BoxGeometry(1.6, 0.09, 0.03), wood, [0, 0.62 + i * 0.12, -0.24 - i * 0.015], [-0.12, 0, 0])
}

/** Silhouette figure (crowd, photographers): capsule-ish body + head, origin at feet. */
export function figure(r: Rand, color = '#0b0b10') {
  const p = new Parts()
  const h = range(r, 1.6, 1.85)
  p.add(new CylinderGeometry(0.16, 0.13, h * 0.42, 7), color, [0, h * 0.62, 0])
  p.add(new CylinderGeometry(0.13, 0.1, h * 0.46, 7), color, [0, h * 0.23, 0])
  p.add(new SphereGeometry(0.11, 8, 6), color, [0, h * 0.9, 0])
  return p.build()
}

/** A geometry where every vertex is white: for instancing with per-instance colour only. */
export function white(g: BufferGeometry) {
  const n = g.attributes.position.count
  g.setAttribute('color', new Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3))
  return g
}

/** White leaf / petal / maple silhouette (alpha) for Falling and ground scatter; tint per instance. */
export function leafTexture(kind: 'leaf' | 'petal' | 'maple') {
  return canvasTexture(64, 64, (ctx, w) => {
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    if (kind === 'petal') {
      ctx.ellipse(w / 2, w / 2, w * 0.28, w * 0.45, 0, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    if (kind === 'maple') {
      // five-lobed star leaf
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2
        const rr = i % 2 === 0 ? w * 0.47 : w * 0.2
        ctx.lineTo(w / 2 + Math.cos(a) * rr, w * 0.52 + Math.sin(a) * rr)
      }
      ctx.fill()
    } else {
      ctx.ellipse(w / 2, w / 2, w * 0.22, w * 0.46, 0.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(120,120,120,0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w / 2, w * 0.95)
    ctx.lineTo(w / 2, w * 0.2)
    ctx.stroke()
  })
}
