import { BufferGeometry, Color, Float32BufferAttribute, Mesh, MeshPhysicalMaterial, OctahedronGeometry, Quaternion, Vector3, type Bone, type Object3D } from 'three'
import { NAIL_ARTS, NAIL_FINISHES, type NailLook, type NailShape } from '../../shared/studio/look'
import type { CareData } from './catalog'
import type { NailFx } from '../state/fx'
import { landmarkWorld, type LandmarkSource } from './rig'
import { basis, toBoneLocal } from './space'

/**
 * Nails: a real curved nail plate per finger, parented to the finger's last bone so it follows
 * every grip. Shape and length rebuild the geometry (natural .. stiletto, up to a long press-on);
 * polish, finish and art are a shader on the plate only, so colour never touches the skin.
 * The manicure animation paints coat by coat through NailFx (cuticle to tip).
 */

const ROWS = 16
const COLS = 9

/** Half-width (0..1 of the nail's half width) at distance y along a plate of total length L. */
function halfWidth(shape: NailShape, y: number, L: number, w: number): number {
  const hw = w / 2
  // rounded cuticle
  const rc = w * 0.32
  const base = y < rc ? Math.sqrt(Math.max(0, 1 - ((rc - y) / rc) ** 2)) : 1
  const fromTip = L - y
  let tip = 1
  switch (shape) {
    case 'natural':
    case 'round': {
      const r = hw * (shape === 'round' ? 1 : 0.9)
      tip = fromTip < r ? Math.sqrt(Math.max(0, 1 - ((r - fromTip) / r) ** 2)) : 1
      break
    }
    case 'square': {
      const r = hw * 0.22
      tip = fromTip < r ? Math.sqrt(Math.max(0, 1 - ((r - fromTip) / r) ** 2)) * 0.25 + 0.75 : 1
      break
    }
    case 'almond': {
      const r = Math.min(L * 0.55, w * 1.35)
      const t = Math.max(0, 1 - fromTip / r)
      tip = Math.cos(t * Math.PI * 0.5) * 0.88 + 0.12 * (1 - t)
      break
    }
    case 'coffin': {
      const r = Math.min(L * 0.5, w * 1.1)
      const t = Math.max(0, 1 - fromTip / r)
      tip = 1 - t * 0.58
      break
    }
    case 'stiletto': {
      const r = Math.min(L * 0.7, w * 1.8)
      const t = Math.max(0, 1 - fromTip / r)
      tip = Math.max(0.02, 1 - t) ** 0.85
      break
    }
  }
  return Math.max(0.015, base * tip)
}

const geoCache = new Map<string, BufferGeometry>()

/** A curved plate: x across, y along the finger (0 = cuticle), z out of the nail. */
export function nailGeometry(shape: NailShape, w: number, l0: number, ext: number): BufferGeometry {
  const key = `${shape}|${w.toFixed(4)}|${l0.toFixed(4)}|${ext.toFixed(4)}`
  const hit = geoCache.get(key)
  if (hit) return hit
  const L = l0 + ext
  const thick = 0.00045 + ext * 0.02
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const curve = (x: number, y: number) => {
    // C-curve across the plate, flattening a little toward a long free edge
    const k = (x / (w / 2)) ** 2
    const lift = y > l0 ? (y - l0) * 0.12 : 0
    return -k * w * 0.2 + lift
  }
  for (const side of [1, -1]) {
    const off = side > 0 ? 0 : -thick
    for (let i = 0; i <= ROWS; i++) {
      const y = (i / ROWS) * L
      const hw = halfWidth(shape, y, L, w) * (w / 2)
      for (let j = 0; j < COLS; j++) {
        const u = j / (COLS - 1)
        const x = (u * 2 - 1) * hw
        pos.push(x, y, curve(x, y) + off)
        uv.push(u, y / L)
      }
    }
  }
  const grid = (ROWS + 1) * COLS
  const at = (s: number, i: number, j: number) => s * grid + i * COLS + j
  for (let i = 0; i < ROWS; i++)
    for (let j = 0; j < COLS - 1; j++) {
      const a = at(0, i, j)
      const b = at(0, i, j + 1)
      const c = at(0, i + 1, j)
      const d = at(0, i + 1, j + 1)
      idx.push(a, b, d, a, d, c)
      const a2 = at(1, i, j)
      const b2 = at(1, i, j + 1)
      const c2 = at(1, i + 1, j)
      const d2 = at(1, i + 1, j + 1)
      idx.push(a2, d2, b2, a2, c2, d2)
    }
  // side walls and the free edge
  for (let i = 0; i < ROWS; i++) {
    for (const j of [0, COLS - 1]) {
      const a = at(0, i, j)
      const b = at(0, i + 1, j)
      const c = at(1, i, j)
      const d = at(1, i + 1, j)
      if (j === 0) idx.push(a, c, d, a, d, b)
      else idx.push(a, b, d, a, d, c)
    }
  }
  for (let j = 0; j < COLS - 1; j++) {
    const a = at(0, ROWS, j)
    const b = at(0, ROWS, j + 1)
    const c = at(1, ROWS, j)
    const d = at(1, ROWS, j + 1)
    idx.push(a, b, d, a, d, c)
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.userData.freeEdge = l0 / L
  geoCache.set(key, g)
  return g
}

export interface NailUniforms {
  uPolish: { value: Color }
  uAmount: { value: number }
  uFinish: { value: number }
  uArt: { value: number }
  uArtColor: { value: Color }
  uBare: { value: Color }
  /** coat progress 0..1 of the stage being painted */
  uCoat: { value: number }
  /** 0 prep, 1 base, 2 colour, 3 art, 4 top, 5 done */
  uStage: { value: number }
  uFree: { value: number }
}

const STAGE_N = { prep: 0, base: 1, colour: 2, art: 3, top: 4, none: 5 } as const

function nailMaterial(): { mat: MeshPhysicalMaterial; u: NailUniforms } {
  const u: NailUniforms = {
    uPolish: { value: new Color() },
    uAmount: { value: 0 },
    uFinish: { value: 0 },
    uArt: { value: 0 },
    uArtColor: { value: new Color() },
    uBare: { value: new Color('#e8c4bc') },
    uCoat: { value: 1 },
    uStage: { value: 5 },
    uFree: { value: 1 },
  }
  const mat = new MeshPhysicalMaterial({ roughness: 0.3, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.2 })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vNailUv;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvNailUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec2 vNailUv;
uniform vec3 uPolish, uArtColor, uBare;
uniform float uAmount, uFinish, uArt, uCoat, uStage, uFree;
float nHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float nNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(nHash(i), nHash(i + vec2(1, 0)), f.x), mix(nHash(i + vec2(0, 1)), nHash(i + vec2(1, 1)), f.x), f.y); }
float nHeart(vec2 p) { p.y = -p.y + 0.12; float a = atan(p.x, p.y) / 3.14159; float r = length(p); float h = abs(a);
  float d = (13.0 * h - 22.0 * h * h + 10.0 * h * h * h) / (6.0 - 5.0 * h); return step(r, d * 0.3); }
float nArt(vec2 uv) {
  int a = int(uArt + 0.5);
  if (a == 1) return step(uFree > 0.95 ? 0.8 : uFree, uv.y);
  if (a == 2) { vec2 g = vec2(uv.x * 3.0, uv.y * 6.0); return step(length(fract(g) - 0.5), 0.22); }
  if (a == 3) { vec2 q = (uv - vec2(0.5, 0.45)) * vec2(2.6, 2.2); return nHeart(q); }
  if (a == 4) { vec2 q = uv - vec2(0.5, 0.45); q.x *= 1.6; float r = length(q); float ang = atan(q.y, q.x);
    float petal = 0.13 + 0.07 * cos(ang * 5.0); return r < 0.05 ? 0.5 : step(r, petal); }
  if (a == 5) return step(0.5, fract((uv.x + uv.y * 0.6) * 4.0));
  if (a == 6) { float n = nNoise(uv * vec2(5.0, 9.0)) + 0.5 * nNoise(uv * vec2(11.0, 19.0)); return smoothstep(0.03, 0.0, abs(fract(n * 2.2) - 0.5) - 0.44); }
  if (a == 7) { vec2 g = uv * vec2(3.5, 7.0); vec2 c = floor(g); vec2 f = fract(g) - 0.5 + (vec2(nHash(c), nHash(c + 7.0)) - 0.5) * 0.4;
    float r = length(f * vec2(1.0, 1.3)); return (step(r, 0.3) - step(r, 0.17)) + step(r, 0.12) * 0.5; }
  return 0.0;
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
vec3 nCol = uBare;
float nRough = 0.42; float nMetal = 0.0; float nGlint = 0.0;
float nBase = uStage > 1.5 || (uStage > 0.5 && vNailUv.y < uCoat) ? 1.0 : 0.0;
if (nBase > 0.5) nRough = 0.22;
bool nPaint = uAmount > 0.01 && (uStage > 2.5 || (uStage > 1.5 && vNailUv.y < uCoat * 1.02));
if (nPaint) {
  int f = int(uFinish + 0.5);
  vec3 pc = uPolish;
  if (f == 1) pc = mix(uBare, uPolish, 0.62);
  if (f == 2) { pc = uPolish * 1.25 + 0.06; nMetal = 0.95; }
  nCol = mix(nCol, pc, uAmount);
  nRough = f == 2 ? 0.12 : 0.16;
  if (f == 3) nGlint = step(0.94, nHash(floor(vNailUv * vec2(40.0, 90.0)))) * 0.9;
  if (f == 4) { float band = exp(-pow((vNormal.x * 1.6 + vNailUv.x - 0.5) * 4.0, 2.0)); nGlint = band * 0.6; nCol *= 0.65; }
}
bool nArtOn = uArt > 0.5 && (uStage > 3.5 || (uStage > 2.5 && vNailUv.y < uCoat * 1.02));
if (nArtOn) { float m = nArt(vNailUv); nCol = mix(nCol, uArtColor, clamp(m, 0.0, 1.0)); }
if (uStage > 4.5 || (uStage > 3.5 && vNailUv.y < uCoat)) nRough = min(nRough, 0.1);
diffuseColor.rgb = nCol;`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = nRough;')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor = nMetal;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += (uPolish * 0.5 + 0.5) * nGlint;')
  }
  mat.customProgramCacheKey = () => 'dollscene-nail-v1'
  return { mat, u }
}

const gemGeo = new OctahedronGeometry(0.0009, 0)
const gemMat = new MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.6, emissive: '#b8c8ff', emissiveIntensity: 0.25 })

export interface NailSet {
  nails: { mesh: Mesh; u: NailUniforms; spec: CareData['nails'][number]; gem: Mesh }[]
  dispose: () => void
}

/** Rest-pose points of each nail (centre, toward the tip, toward the side), bound as landmarks. */
export function nailPoints(care: CareData): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  care.nails.forEach((n, i) => {
    const c = new Vector3(...n.p)
    const d = new Vector3(...n.dir)
    const side = new Vector3().crossVectors(new Vector3(...n.n), d).normalize()
    out[`nail:${i}:c`] = c.toArray()
    out[`nail:${i}:t`] = c.clone().addScaledVector(d, n.length * 0.5).toArray()
    out[`nail:${i}:s`] = c.clone().addScaledVector(side, n.width * 0.5).toArray()
  })
  return out
}

/**
 * Build the ten nail plates and parent them to the distal finger bones. The frame comes from the
 * live skinned nail surface (three bound vertices) so it is right for every body and pose.
 */
export function buildNails(root: Object3D, care: CareData, lm: LandmarkSource): NailSet {
  const nails: NailSet['nails'] = []
  const pc = new Vector3()
  const pt = new Vector3()
  const ps = new Vector3()
  care.nails.forEach((spec, i) => {
    const bone = root.getObjectByName(spec.bone) as Bone | undefined
    if (!bone || !landmarkWorld(lm, `nail:${i}:c`, pc) || !landmarkWorld(lm, `nail:${i}:t`, pt) || !landmarkWorld(lm, `nail:${i}:s`, ps)) return
    const { mat, u } = nailMaterial()
    const mesh = new Mesh(nailGeometry('natural', spec.width, spec.length, 0), mat)
    mesh.name = `Nail_${spec.bone}`
    mesh.frustumCulled = false
    // along the finger (y), across the nail (x), out of the nail (z)
    const f = basis(pt.clone().sub(pc), ps.clone().sub(pc))
    const origin = pc.clone().addScaledVector(f.y, -spec.length / 2).addScaledVector(f.z, 0.00035)
    toBoneLocal(bone, origin, f.x, f.y, f.z, mesh)
    const gem = new Mesh(gemGeo, gemMat)
    gem.position.set(0, spec.length * 0.35, 0.0008)
    gem.visible = false
    mesh.add(gem)
    nails.push({ mesh, u, spec, gem })
  })
  return {
    nails,
    dispose: () => {
      for (const n of nails) {
        n.mesh.parent?.remove(n.mesh)
        ;(n.mesh.material as MeshPhysicalMaterial).dispose()
      }
    },
  }
}

const bareTmp = new Color()

/** Shape and length change geometry; polish, finish and art are uniforms. */
export function applyNailLook(set: NailSet, nl: NailLook, tone: string) {
  const ext = nl.length * 0.014
  // A bare nail is the skin tone lifted toward pink, so it reads as a nail on every tone.
  bareTmp.set(tone).lerp(new Color('#f2c6c0'), 0.6)
  for (const n of set.nails) {
    const isThumb = n.spec.bone.includes('Thumb')
    const g = nailGeometry(nl.shape, n.spec.width, n.spec.length, ext * (isThumb ? 0.85 : 1))
    if (n.mesh.geometry !== g) n.mesh.geometry = g
    n.u.uPolish.value.set(nl.color)
    n.u.uAmount.value = nl.amount
    n.u.uFinish.value = NAIL_FINISHES.indexOf(nl.finish)
    n.u.uArt.value = NAIL_ARTS.indexOf(nl.art)
    n.u.uArtColor.value.set(nl.artColor)
    n.u.uBare.value.copy(bareTmp)
    n.u.uFree.value = (g.userData.freeEdge as number) ?? 1
    n.gem.visible = nl.gems && (n.spec.bone.includes('Ring') || isThumb)
  }
}

/** Per-frame manicure progress. */
export function applyNailFx(set: NailSet, f: NailFx) {
  const stage = STAGE_N[f.stage]
  set.nails.forEach((n, i) => {
    n.u.uStage.value = stage
    n.u.uCoat.value = f.coat[i] ?? 1
  })
}

/** World-space centre of a nail (for the polish brush to reach). */
export function nailWorld(set: NailSet, i: number, out = new Vector3()) {
  const n = set.nails[i]
  if (!n) return null
  n.mesh.updateWorldMatrix(true, false)
  const L = (n.mesh.geometry.boundingBox ?? (n.mesh.geometry.computeBoundingBox(), n.mesh.geometry.boundingBox))!.max.y
  return out.set(0, L * 0.45, 0.001).applyMatrix4(n.mesh.matrixWorld)
}

export function nailNormal(set: NailSet, i: number, out = new Vector3()) {
  const n = set.nails[i]
  if (!n) return null
  return out.set(0, 0, 1).applyQuaternion(n.mesh.getWorldQuaternion(new Quaternion())).normalize()
}

