import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Component, Suspense, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Color,
  DoubleSide,
  FrontSide,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  NoColorSpace,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Bone,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
  type Texture,
} from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { clinicEffect, effectiveMorphs } from '../../shared/studio/clinic'
import { ALL_MORPHS, EXPRESSIONS, SPOT_IDS, type ClinicId, type ExpressionId, type HairId, type MorphId, type SpotId, type StudioLook } from '../../shared/studio/look'
import { actionProps, getCharacter, headNormal, headUp, isRunning, setCharacter, stepActions, type Character } from '../actions/engine'
import { fx } from '../state/fx'
import { useStudio, type ExpressionPreset, type PoseId } from '../state/store'
import { attachModule } from '../../three/doll/attachModule'
import { url, type CharacterCatalog } from './catalog'
import { applyHairFrame, applyHairLook, isHairMaterial, setupHairMaterial, wetResponse, type HairUniforms } from './hairMaterial'
import { buildJewellery } from './jewellery'
import { applyNailFx, applyNailLook, buildNails, nailPoints, type NailSet } from './nails'
import { idleRig, idleTick, relaxPose } from './pose'
import { applyPose, EXPRESSION_WEIGHTS, POSE_FACE, POSE_PROPS } from './poses'
import { propSlot, updateProp, type PropSlot } from './props'
import { bindLandmarks, buildHandRig, landmarkWorld, type HandRig, type LandmarkSource, type Side } from './rig'
import { applyLookToSkin, createSkinMaterial, type SkinUniforms } from './skinMaterial'
import { boneLocalToMeshSpace, eyeCentres } from './space'

/**
 * The studio's 3D character: the CC0 MakeHuman-derived base (public/models/studio/body.glb)
 * plus hair, outfit and shoe modules bound to its skeleton by bone name. Every mesh's
 * "<Morph>_Neg" / "<Morph>_Pos" targets follow the locked base shape plus any clinic procedure,
 * so clothes and hair reshape with the body. "Expr_*" keys carry facial expressions.
 *
 * Everything the look and the running routine describe is drawn for real: skincare on the skin
 * shader, pimple patches as meshes stuck to the skin, nail plates on the finger bones, jewellery
 * on the head/spine/hand bones, haircare in the hair shader, and two procedural hands (IK) that
 * hold props and touch the face.
 */

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true

function applyMorphs(mesh: Mesh, morphs: Record<MorphId, number>) {
  const dict = mesh.morphTargetDictionary
  const inf = mesh.morphTargetInfluences
  if (!dict || !inf) return
  for (const m of ALL_MORPHS) {
    const v = morphs[m]
    const neg = dict[`${m}_Neg`]
    const pos = dict[`${m}_Pos`]
    if (neg !== undefined) inf[neg] = Math.max(0, (0.5 - v) * 2)
    if (pos !== undefined) inf[pos] = Math.max(0, (v - 0.5) * 2)
  }
}

function applyExpression(mesh: Mesh, w: Record<ExpressionId, number>) {
  const dict = mesh.morphTargetDictionary
  const inf = mesh.morphTargetInfluences
  if (!dict || !inf) return
  for (const e of EXPRESSIONS) {
    const i = dict[e]
    if (i !== undefined) inf[i] = w[e]
  }
}

const maskTex = (t: Texture) => {
  t.flipY = false
  t.colorSpace = NoColorSpace
  t.needsUpdate = true
  return t
}

const eyeTextures = new Map<string, Promise<Texture>>()
export function eyeTexture(id: string) {
  let p = eyeTextures.get(id)
  if (!p) {
    p = new TextureLoader().loadAsync(url.eye(id)).then((t) => {
      t.flipY = false
      t.colorSpace = SRGBColorSpace
      return t
    })
    p.catch(() => eyeTextures.delete(id))
    eyeTextures.set(id, p)
  }
  return p
}

const HAIR_K = 1 / 0.62

/** Only the chosen brow and lash meshes are drawn; brows take the brow colour, lashes the mascara. */
function showVariants(brows: Map<string, Mesh>, lashes: Map<string, Mesh>, look: StudioLook, mascara: number) {
  for (const [id, mesh] of brows) {
    mesh.visible = id === look.brows.shape
    const mat = mesh.material as MeshStandardMaterial
    mat.color.set(look.brows.color).multiplyScalar(HAIR_K * (look.brows.style === 'laminated' ? 1.15 : 1))
    mat.alphaTest = look.brows.style === 'pomade' ? 0.02 : 0.04
  }
  for (const [id, mesh] of lashes) {
    mesh.visible = id === look.lashes.style
    const mat = mesh.material as MeshStandardMaterial
    // Mascara: deeper black and more of each lash card shows (fuller, longer-looking lashes).
    mat.color.set('#0B0807').multiplyScalar(HAIR_K * (1 - mascara * 0.6))
    mat.alphaTest = 0.22 - mascara * 0.2
    mat.needsUpdate = true
  }
}

/* ------------------------------------------------------------------ modules */

/**
 * One hairstyle or garment failing to download must not take the doll down: the boundary keeps
 * her on screen, drops the failed file from the loader cache (so a retry fetches it again) and
 * lets the character put back the last module that did load.
 */
class ModuleBoundary extends Component<{ children: ReactNode; src: string; onFail: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: Error) {
    console.error('module failed', this.props.src, e)
    useGLTF.clear(this.props.src)
    this.props.onFail()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}


type Registry = { add: (meshes: Mesh[]) => void; remove: (meshes: Mesh[]) => void; attached: (src: string, on: boolean) => void }

/**
 * Pooled modules: each hairstyle, outfit or pair of shoes is cloned and bound to a doll's skeleton
 * once, then shown and hidden as the look changes. Switching dolls (or trying things on) is a
 * visibility swap in the same frame: no reload, no flash of the previous doll, no half-dressed frame.
 */
const pool = new WeakMap<Object3D, Map<string, { gltf: unknown; attached: Object3D; meshes: Mesh[] }>>()

function useModule(src: string, base: Object3D, registry: Registry, style: (meshes: Mesh[]) => void, onAttach?: () => () => void) {
  const gltf = useGLTF(src, false, true)
  useLayoutEffect(() => {
    let byBase = pool.get(base)
    if (!byBase) pool.set(base, (byBase = new Map()))
    let entry = byBase.get(src)
    if (!entry || entry.gltf !== gltf) {
      const clone = SkeletonUtils.clone(gltf.scene)
      const attached = attachModule(base, clone)
      const meshes: Mesh[] = []
      attached.traverse((o) => {
        if (!isMesh(o)) return
        o.frustumCulled = false
        if (!o.userData.ownMat) {
          o.material = (o.material as Material).clone()
          o.userData.ownMat = true
        }
        meshes.push(o)
      })
      entry = { gltf, attached, meshes }
      byBase.set(src, entry)
    } else if (!entry.attached.parent) base.add(entry.attached)
    const e = entry
    e.attached.visible = true
    style(e.meshes)
    registry.add(e.meshes)
    registry.attached(src, true)
    const detach = onAttach?.()
    return () => {
      detach?.()
      registry.remove(e.meshes)
      registry.attached(src, false)
      e.attached.visible = false
      e.attached.parent?.remove(e.attached)
    }
    // style reads the latest look through a ref; re-attaching on every look change would be wasteful
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, base, registry])
}

/** Module files already downloaded (the boot preloads them all): those swap without deferral. */
export const loadedModules = new Set<string>()

interface HairModuleProps {
  id: string
  base: Object3D
  registry: Registry
  look: StudioLook
  head: Bone | null
  headLocalC: Vector3
  /** 0 normal; 1 revealed section by section; 2 removed section by section. */
  mode?: 0 | 1 | 2
  dir?: 0 | 1
  /** The style whose wet response applies. */
  wetAs: HairId | 'bonnet'
  clinic: Partial<Record<ClinicId, number>>
  onLoaded?: (id: string) => void
}

function HairModule({ id, base, registry, look, head, headLocalC, mode = 0, dir = 0, wetAs, clinic, onLoaded }: HairModuleProps) {
  const tinted = useRef<{ mat: MeshStandardMaterial; u: HairUniforms }[]>([])
  const meshes = useRef<Mesh[]>([])
  useModule(url.hair(id), base, registry, (m) => {
    tinted.current = []
    meshes.current = m
    for (const mesh of m) {
      const mat = mesh.material as MeshStandardMaterial
      mesh.userData.hairModule = id
      if (isHairMaterial(mat)) {
        // the skull centre in this module's own (quantised) geometry space
        const sm = mesh as SkinnedMesh
        const c = (sm.isSkinnedMesh && head && boneLocalToMeshSpace(sm, head, headLocalC)) || new Vector3(0, 1.5, 0)
        tinted.current.push({ mat, u: setupHairMaterial(mat, c) })
      }
      else {
        // accents (beads, cuffs, the satin bonnet) stay opaque, write depth and keep their colour
        mat.transparent = false
        mat.depthWrite = true
        mat.alphaTest = 0.5
      }
    }
    onLoaded?.(id)
  })
  useLayoutEffect(() => {
    for (const { mat, u } of tinted.current) applyHairLook(mat, u, look.hair)
  }, [look.hair, id])
  const response = useMemo(() => wetResponse(wetAs), [wetAs])
  useFrame(() => {
    const change = look.hair.care.change
    const sections = change ? Array.from({ length: 8 }, (_, i) => (change.sections & (1 << i) ? 1 : fx.hair.sections[i] ?? 0)) : null
    const frame = {
      wet: Math.max(look.hair.care.wet, fx.hair.wet),
      foam: fx.hair.foam,
      cream: fx.hair.cream,
      density: clinicEffect(look, 'density', clinic),
      response,
      sections,
      mode,
      dir,
    }
    for (const { u } of tinted.current) applyHairFrame(u, frame)
  })
  return null
}

function OutfitModule({ src, mask, base, registry, onMask, dye, onLoaded }: { src: string; mask: string | null; base: Object3D; registry: Registry; onMask: (t: Texture | null) => void; dye?: StudioLook['outfit']; onLoaded?: () => void }) {
  const hide = useTexture(mask ?? url.mask('body'))
  const uniforms = useRef({ uDye: { value: new Color() }, uDyeAmount: { value: 0 } })
  useModule(
    src,
    base,
    registry,
    (meshes) => {
      for (const mesh of meshes) {
        const mat = mesh.material as MeshStandardMaterial
        // the fabric's finish travels in its material name (scripts/character/outfit/build_outfits.py)
        const finish = mat.name.replace(/\.\d+$/, '')
        mat.alphaTest = finish === 'Fabric_net' ? 0.5 : 0.4
        mat.transparent = false
        // The glTF loader turns depth writes off for alpha-blend materials; as an opaque cutout the
        // garment must write depth, or later transparent passes (the studio floor, a scene's water
        // or shadows) draw straight over it and the legs look see-through.
        mat.depthWrite = true
        // Front faces only: garments are closed shells, and double-sided drawing let the inside of
        // the fabric win the depth test at the shoulders (dark torn-looking shards).
        mat.side = finish === 'Fabric_net' ? DoubleSide : FrontSide
        mat.roughness = { Fabric_satin: 0.36, Fabric_sequin: 0.3, Fabric_denim: 0.9, Fabric_leather: 0.45, Fabric_net: 0.7 }[finish] ?? 0.75
        mat.metalness = finish === 'Fabric_sequin' ? 0.35 : 0
        mat.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms.current)
          // Cloth offset: the garment rides ~3.5 mm off the skin (along its skinned normal, in
          // metres, after skinning: the geometry itself is quantised), so small skinning
          // differences between body and fabric at the shoulders and armpits stay under the
          // fabric instead of poking through it.
          shader.vertexShader = shader.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * 0.0035;')
          if (dye)
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform vec3 uDye;\nuniform float uDyeAmount;')
              .replace(
                '#include <map_fragment>',
                '#include <map_fragment>\nfloat dsL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\ndiffuseColor.rgb = mix(diffuseColor.rgb, uDye * (0.25 + dsL * 1.6), uDyeAmount);',
              )
        }
        mat.customProgramCacheKey = () => (dye ? 'dollscene-fabric-dye' : 'dollscene-fabric')
        mat.needsUpdate = true
      }
    },
    () => {
      onLoaded?.()
      if (!mask) return () => {}
      onMask(maskTex(hide))
      return () => onMask(null)
    },
  )
  useLayoutEffect(() => {
    if (!dye) return
    uniforms.current.uDye.value.set(dye.dye)
    uniforms.current.uDyeAmount.value = dye.dyeAmount
  }, [dye])
  return null
}

/* ------------------------------------------------------------------ patches */

const patchGeo = new SphereGeometry(0.012, 18, 4, 0, Math.PI * 2, 0, 0.47).translate(0, -0.012 * Math.cos(0.47), 0)
const patchMat = new MeshPhysicalMaterial({ color: '#e3cdb4', roughness: 0.28, transparent: true, opacity: 0.6, depthWrite: false, sheen: 0.4, sheenColor: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2 })

const pv = new Vector3()
const pn = new Vector3()
const pside = new Vector3()
const pq = new Quaternion()
const yAxis = new Vector3(0, 1, 0)

/* ------------------------------------------------------------------ per frame */

interface FrameState {
  blink: { next: number; t: number }
  exprW: Record<ExpressionId, number>
  inv: Matrix4
}

interface RigParts {
  hands: Record<Side, HandRig> | null
  landmarks: LandmarkSource
  nails: NailSet | null
  patches: Map<SpotId, Mesh>
  props: Record<Side, PropSlot>
  propRoot: Group
}

interface FrameInput {
  t: number
  dt: number
  animate: boolean
  setup: { idle: ReturnType<typeof idleRig>; model: Object3D; skin: SkinUniforms | null }
  rig: RigParts | null
  look: StudioLook
  clinic: Partial<Record<ClinicId, number>>
  pose: PoseId | 'present' | null
  expression: ExpressionPreset | null
  morphMeshes: Set<Mesh>
  care: CharacterCatalog['care']
  /** This doll's own character rig (hands, landmarks). */
  char: Character | null
  remote: boolean
  /** Every layer (body, hair, outfit, shoes) attached: until then the doll isn't drawn. */
  complete: boolean
}

/** One frame of the character, in order: idle → routine (or held pose) → face → skin → attachments. */
function frameUpdate(f: FrameState, i: FrameInput) {
  const { t, setup } = i
  const dt = Math.min(i.dt, 0.1)
  const running = !i.remote && isRunning()
  setup.model.visible = i.complete
  // Keep the head steady while the hands work near the face.
  idleTick(setup.idle, t, i.animate ? (running ? 0.25 : 1) : 0)
  setup.model.updateMatrixWorld(true)
  if (!i.remote) stepActions(dt)
  const l = i.look
  const c = i.char
  const mine = !!c && (i.remote || getCharacter()?.root === setup.model)
  if (!running && mine) applyPose(c!, i.pose ?? 'relaxed', t, dt)

  // expressions: the routine/photo-mode weights, the morning face and a natural blink
  const want = i.remote ? {} : useStudio.getState().expression
  const photo = !running && i.expression ? EXPRESSION_WEIGHTS[i.expression] : null
  const w = f.exprW
  for (const e of EXPRESSIONS) w[e] = want[e] ?? photo?.[e] ?? 0
  const poseFace = !running && i.pose ? POSE_FACE[i.pose]?.(t) : null
  if (poseFace) for (const [e, v] of Object.entries(poseFace) as [ExpressionId, number][]) w[e] = Math.max(w[e], v)
  if (l.care.morning) w.Expr_Sleepy = Math.max(w.Expr_Sleepy, 0.75)
  const b = f.blink
  if (i.animate) {
    if (b.t < 0 && t > b.next) b.t = 0
    if (b.t >= 0) {
      b.t += dt
      const k = Math.sin(Math.min(1, b.t / 0.16) * Math.PI)
      w.Expr_BlinkL = Math.max(w.Expr_BlinkL, k)
      w.Expr_BlinkR = Math.max(w.Expr_BlinkR, k)
      if (b.t > 0.16) {
        b.t = -1
        b.next = t + 2.2 + Math.random() * 3.5
      }
    }
  }
  for (const m of i.morphMeshes) applyExpression(m, w)

  if (setup.skin) applyLookToSkin(setup.skin, l, i.remote ? { clinic: i.clinic, care: i.care } : { reveal: fx.makeup.reveal, clinic: i.clinic, fx: fx.skin, care: i.care })

  const r = i.rig
  if (!r) return
  if (r.nails && !i.remote) applyNailFx(r.nails, fx.nails)
  setup.model.updateMatrixWorld(true)
  f.inv.copy(r.propRoot.matrixWorld).invert()
  // patches stay glued to their spot on the (moving, morphing) skin until peeled
  for (const [id, mesh] of r.patches) {
    const on = l.care.patches.includes(id)
    const peel = fx.skin.peel[id] ?? 0
    mesh.visible = mine && on && peel < 0.999
    if (!mesh.visible || !c) continue
    const spot = i.care?.spots.find((s) => s.id === id)
    if (!spot || !landmarkWorld(c.landmarks, `spot:${id}`, pv)) continue
    pn.copy(headNormal(c, spot.n))
    pq.setFromUnitVectors(yAxis, pn)
    if (peel > 0) {
      // lift from one edge, curling up and away
      pside.crossVectors(pn, headUp(c)).normalize()
      const hinge = pv.clone().addScaledVector(pside, -0.0055)
      const rot = new Quaternion().setFromAxisAngle(headUp(c), -Math.min(1, peel / 0.6) * 1.9)
      pv.sub(hinge).applyQuaternion(rot).add(hinge)
      pq.premultiply(rot)
      const held = fx.skin.held
      if (held && held.id === id && peel > 0.55) pv.lerp(held.p, Math.min(1, (peel - 0.55) / 0.15))
    }
    mesh.matrix.compose(pv.addScaledVector(pn, 0.0004), pq, one)
    mesh.matrix.premultiply(f.inv)
    mesh.matrixWorldNeedsUpdate = true
  }
  if (r.hands) {
    const held = running ? actionProps : (i.pose && POSE_PROPS[i.pose]) || NO_PROPS
    updateProp(r.props.Left, r.hands.Left, held.Left ?? null, f.inv)
    updateProp(r.props.Right, r.hands.Right, held.Right ?? null, f.inv)
  }
}

const one = new Vector3(1, 1, 1)
const NO_PROPS = { Left: null, Right: null }

/* ------------------------------------------------------------------ arm clearance */

const cv = new Vector3()
const toModel = new Matrix4()

/** Torso, hip and thigh vertices (by skin weight) the relaxed arms must stay outside of. */
function clearanceCandidates(body: SkinnedMesh) {
  const idx = body.geometry.attributes.skinIndex
  const wt = body.geometry.attributes.skinWeight
  const names = body.skeleton.bones.map((b) => b.name)
  const ok = new Set(['Hips', 'Spine', 'Spine1', 'Spine2', 'LeftUpLeg', 'RightUpLeg'])
  const out: number[] = []
  for (let i = 0; i < idx.count; i += 2) {
    let best = 0
    let bone = -1
    for (let k = 0; k < 4; k++) {
      const w = wt.getComponent(i, k)
      if (w > best) {
        best = w
        bone = idx.getComponent(i, k)
      }
    }
    if (bone >= 0 && ok.has(names[bone])) out.push(i)
  }
  return out
}

/**
 * How far to open the relaxed arms (relaxPose `out`) so the elbows, wrists and hands rest outside
 * her body: measured on the live, morphed, skinned mesh at each joint's height, plus the outfit's
 * skirt ease and the arm's own girth (fuller arms need more room). Arm LENGTH never changes.
 */
function armClearance(model: Object3D, body: SkinnedMesh, cands: number[], morphs: Record<MorphId, number>, ease: number) {
  model.updateMatrixWorld(true)
  toModel.copy(model.matrixWorld).invert()
  const pts: number[] = []
  for (const i of cands) {
    body.getVertexPosition(i, cv)
    cv.applyMatrix4(body.matrixWorld).applyMatrix4(toModel)
    pts.push(cv.x, cv.y)
  }
  const widthAt = (y: number, side: 1 | -1) => {
    let w = 0
    for (let k = 0; k < pts.length; k += 2) if (Math.abs(pts[k + 1] - y) < 0.022 && pts[k] * side > w) w = pts[k] * side
    return w + (y > 0.6 && y < 0.95 ? ease : 0)
  }
  const fat = Math.max(0, morphs.Arms - 0.5) + Math.max(0, morphs.Softness - 0.5)
  // how far each joint's centre must sit outside the body: the elbow's own half-width, and for the
  // hand just its half-thickness (palm toward the thigh: a relaxed hand rests against it, never in it)
  const joints: [string, number][] = [
    ['ForeArm', 0.034 * (1 + fat * 0.7)],
    ['Hand', 0.02 * (1 + fat * 0.4)],
    ['HandMiddle1', 0.014],
  ]
  for (let out = 0.2; out <= 0.78; out += 0.03) {
    relaxPose(model, out)
    model.updateMatrixWorld(true)
    let clear = true
    for (const [side, sgn] of [['Left', 1], ['Right', -1]] as const) {
      for (const [name, r] of joints) {
        const b = model.getObjectByName(`${side}${name}`)
        if (!b) continue
        b.getWorldPosition(cv).applyMatrix4(toModel)
        if (cv.x * sgn < widthAt(cv.y, sgn) + r) clear = false
      }
    }
    if (clear) return out
  }
  return 0.78
}

/* ------------------------------------------------------------------ character */

export interface StudioCharacterProps {
  look: StudioLook
  catalog: CharacterCatalog
  animate: boolean
  /** Clinic procedures being previewed (never saved by rendering them). */
  clinicPreview?: Partial<Record<ClinicId, number>> | null
  /** Called once the body, hands and anchors are ready for routines. */
  onReady?: () => void
  /** Held pose when no routine is running (photo mode, showing the nails). */
  pose?: PoseId | 'present' | null
  /** Photo-mode expression. */
  expression?: ExpressionPreset | null
  /**
   * Another player's doll at a scene: no routines, no global character, its own pose and
   * expression. (The player's own doll drives the routines and the studio camera.)
   */
  remote?: boolean
}

export function StudioCharacter({ look, catalog, animate, clinicPreview, onReady, pose = null, expression = null, remote = false }: StudioCharacterProps) {
  const { scene } = useGLTF(url.body, false, true)
  const hasRegions = !!catalog.masks?.faceD && !!catalog.masks?.faceE
  const [faceA, faceB, faceC, bodyMask, faceD, faceE] = useTexture([
    url.mask('face_a'),
    url.mask('face_b'),
    url.mask('face_c'),
    url.mask('body'),
    url.mask(hasRegions ? 'face_d' : 'face_a'),
    url.mask(hasRegions ? 'face_e' : 'face_b'),
  ])

  const setup = useMemo(() => {
    const model = SkeletonUtils.clone(scene)
    let skin: SkinUniforms | null = null
    let baseNormal: { x: number; y: number } | null = null
    let skinMat: MeshPhysicalMaterial | null = null
    const brows = new Map<string, Mesh>()
    const lashes = new Map<string, Mesh>()
    let eyes: Mesh | null = null
    let body: SkinnedMesh | null = null
    const base: Mesh[] = []
    model.traverse((o) => {
      if (!isMesh(o)) return
      o.frustumCulled = false
      const src = o.material as MeshStandardMaterial
      base.push(o)
      if (src.name === 'Skin') {
        const s = createSkinMaterial(
          src,
          { faceA: maskTex(faceA), faceB: maskTex(faceB), faceC: maskTex(faceC), faceD: hasRegions ? maskTex(faceD) : null, faceE: hasRegions ? maskTex(faceE) : null, body: maskTex(bodyMask) },
          catalog.faceRect,
        )
        o.material = s.material
        skin = s.uniforms
        skinMat = s.material
        baseNormal = { x: s.baseNormal.x, y: s.baseNormal.y }
        body = o as SkinnedMesh
      } else {
        const mat = src.clone()
        o.material = mat
        if (o.name.startsWith('Brows_')) {
          brows.set(o.name.slice(6), o)
          Object.assign(mat, { transparent: true, depthWrite: false, alphaTest: 0.04, roughness: 0.8 })
        } else if (o.name.startsWith('Lashes_')) {
          lashes.set(o.name.slice(7), o)
          Object.assign(mat, { transparent: true, depthWrite: false, alphaTest: 0.04, side: DoubleSide, roughness: 0.7 })
          mat.color.set('#0B0807').multiplyScalar(HAIR_K)
        } else if (o.name === 'Eyes' || src.name === 'Eyes') {
          eyes = o
          // One mesh: opaque eyeball plus a clear cornea shell (alpha in the iris texture).
          Object.assign(mat, { roughness: 0.06, metalness: 0, transparent: true, alphaTest: 0.02 })
        }
        mat.needsUpdate = true
      }
    })
    // Bind the face, wipe-path, blemish and nail anchors to body vertices while the skeleton is
    // still in its bind pose: the anchors are rest-pose positions, and the hands move once the
    // arms relax.
    let landmarks: LandmarkSource | null = null
    const care = catalog.care
    if (body && care) {
      const points: Record<string, readonly number[]> = {}
      for (const [k, l] of Object.entries(care.landmarks)) points[k] = l.p
      for (const [k, list] of Object.entries(care.strokes)) list.forEach((p, i) => (points[`stroke:${k}:${i}`] = p))
      for (const sp of care.spots) points[`spot:${sp.id}`] = sp.p
      Object.assign(points, nailPoints(care))
      // The build's under-eye anchors lean toward the nose; place them from the real eyeballs.
      const eyes = eyeCentres(model)
      if (eyes) {
        for (const [side, c, s] of [
          ['L', eyes.L, 1],
          ['R', eyes.R, -1],
        ] as const) {
          const under = c.clone().add(new Vector3(0, -eyes.radius * 1.05, eyes.radius * 0.55))
          points[`underEye${side}`] = under.toArray()
          for (let i = 0; i < 4; i++) points[`stroke:underEye${side}:${i}`] = under.clone().add(new Vector3(s * (-0.008 + i * 0.0065), -0.001 * Math.abs(i - 1.5), 0)).toArray()
        }
      }
      landmarks = bindLandmarks(body, points, model)
    }
    // Dev screenshots can keep the rest A-pose (?pose=a) to tell skinning issues from asset ones.
    if (!(import.meta.env.DEV && new URLSearchParams(location.search).get('pose') === 'a')) relaxPose(model)
    const headBone = (model.getObjectByName('Head') as Bone | undefined) ?? null
    // The skull centre in head-bone space (for wet-hair shrinkage and hair-surface paths): a
    // little above and in front of the head joint, measured on the posed bones (not boneInverses,
    // which carry each module's quantisation).
    const headLocalC = new Vector3(0, 0.085, 0.01)
    if (headBone) {
      model.updateMatrixWorld(true)
      const c = headBone.getWorldPosition(new Vector3()).add(new Vector3(0, 0.085, 0.01))
      headLocalC.copy(c.applyMatrix4(new Matrix4().copy(headBone.matrixWorld).invert()))
    }
    return {
      model,
      skin: skin as SkinUniforms | null,
      skinMat: skinMat as MeshPhysicalMaterial | null,
      baseNormal: baseNormal as { x: number; y: number } | null,
      brows,
      lashes,
      eyes: eyes as Mesh | null,
      body: body as SkinnedMesh | null,
      head: headBone,
      headLocalC,
      landmarks,
      base,
      idle: idleRig(model),
    }
  }, [scene, faceA, faceB, faceC, bodyMask, faceD, faceE, hasRegions, catalog.faceRect, catalog.care])

  const clinic = clinicPreview ?? look.clinic
  const morphs = useMemo(() => effectiveMorphs(look, clinic), [look, clinic])

  // Every mesh with morph targets: the body set plus whatever modules are attached.
  const morphsRef = useRef(morphs)
  morphsRef.current = morphs
  const morphMeshes = useMemo(() => new Set<Mesh>(setup.base), [setup])
  const attachedSrc = useRef(new Set<string>())
  const registry = useMemo<Registry>(
    () => ({
      add: (meshes) =>
        meshes.forEach((m) => {
          morphMeshes.add(m)
          applyMorphs(m, morphsRef.current)
        }),
      remove: (meshes) => meshes.forEach((m) => morphMeshes.delete(m)),
      attached: (src, on) => void (on ? attachedSrc.current.add(src) : attachedSrc.current.delete(src)),
    }),
    [morphMeshes],
  )

  useLayoutEffect(() => {
    for (const m of morphMeshes) applyMorphs(m, morphs)
  }, [morphs, morphMeshes])

  useLayoutEffect(() => {
    showVariants(setup.brows, setup.lashes, look, look.makeup.mascara)
    // Primer and full coverage soften the skin's micro-texture.
    if (setup.skinMat && setup.baseNormal) {
      const k = 1 - look.makeup.primer * 0.35 - look.makeup.foundation.amount * 0.2
      setup.skinMat.normalScale.set(setup.baseNormal.x * k, setup.baseNormal.y * k)
    }
  }, [look, setup])

  useEffect(() => {
    let live = true
    const eyes = setup.eyes
    if (!eyes) return
    eyeTexture(look.eyes.iris).then(
      (t) => {
        if (!live) return
        const mat = eyes.material as MeshStandardMaterial
        mat.map = t
        mat.needsUpdate = true
      },
      () => live && useStudio.getState().notify('That eye colour couldn’t load. Your current look is safe.', 'error'),
    )
    return () => {
      live = false
    }
  }, [look.eyes.iris, setup])

  /* ---- hands, landmarks, nails, patches, props: everything that needs the bound body ---- */
  const rigRef = useRef<RigParts | null>(null)
  const charRef = useRef<Character | null>(null)
  const [rigVersion, setRigVersion] = useState(0)
  const hairMeshes = useRef<() => Mesh[]>(() => [])
  // the last modules that really loaded (to fall back to if a new one fails)
  const good = useRef<{ hair: string | null; outfit: string | null; shoes: string | null }>({ hair: null, outfit: null, shoes: null })
  hairMeshes.current = () => [...morphMeshes].filter((m) => m.userData.hairModule)

  useEffect(() => {
    const { model, body, head } = setup
    const care = catalog.care
    if (!body || !head || !care) {
      onReady?.()
      return
    }
    model.updateMatrixWorld(true)
    const left = buildHandRig(model, 'Left')
    const right = buildHandRig(model, 'Right')
    const landmarks = setup.landmarks
    if (!landmarks) {
      onReady?.()
      return
    }
    const nails = care.nails.length ? buildNails(model, care, landmarks) : null
    const patches = new Map<SpotId, Mesh>()
    const propRoot = new Group()
    propRoot.name = 'dollscene:props'
    for (const id of SPOT_IDS) {
      const m = new Mesh(patchGeo, patchMat)
      m.visible = false
      m.frustumCulled = false
      m.matrixAutoUpdate = false
      m.renderOrder = 2
      propRoot.add(m)
      patches.set(id, m)
    }
    const props = { Left: propSlot(), Right: propSlot() }
    propRoot.add(props.Left.group, props.Right.group)
    model.add(propRoot)
    const headRestQ = head.getWorldQuaternion(new Quaternion())
    rigRef.current = { hands: left && right ? { Left: left, Right: right } : null, nails, patches, props, propRoot, landmarks }
    setRigVersion((n) => n + 1)
    if (left && right) {
      const c: Character = { root: model, body, head, headLocalC: setup.headLocalC, hands: { Left: left, Right: right }, landmarks, care, headRestQ, hair: () => hairMeshes.current(), nails }
      charRef.current = c
      if (!remote) setCharacter(c)
    }
    onReady?.()
    return () => {
      charRef.current = null
      if (getCharacter()?.root === model) setCharacter(null)
      nails?.dispose()
      model.remove(propRoot)
      rigRef.current = null
    }
    // onReady is a notification; re-binding the rig when its identity changes would be wasteful
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup, catalog.care])

  // Nails follow the look (shape/length rebuild the plate, the rest are uniforms).
  useEffect(() => {
    const n = rigRef.current?.nails
    if (n) applyNailLook(n, look.nails, look.skin.tone)
  }, [look.nails, look.skin.tone, setup, catalog.care, rigVersion])

  // Jewellery is rebuilt when it changes (a handful of tiny meshes), once the skin is bound.
  useEffect(() => {
    const r = rigRef.current
    const care = catalog.care
    if (!r || !care) return
    // fit on the next frame, once the renderer has posed and scaled the new doll
    let set: ReturnType<typeof buildJewellery> | null = null
    const id = requestAnimationFrame(() => (set = buildJewellery(setup.model, care, r.landmarks, look.jewellery)))
    return () => {
      cancelAnimationFrame(id)
      set?.dispose()
    }
    // refit when her face, height or the clinic changes the shape the pieces sit on
  }, [look.jewellery, morphs, look.height, setup, catalog.care, rigVersion])

  /* ---- relaxed arms rest outside her hips (and skirt), however full her figure ---- */
  const outfitEase = catalog.outfits.find((o) => o.id === look.outfit.id)?.ease ?? 0
  const candidates = useMemo(() => (setup.body ? clearanceCandidates(setup.body) : []), [setup])
  useEffect(() => {
    const r = rigRef.current
    if (!setup.body || !r?.hands || !candidates.length) return
    const out = armClearance(setup.model, setup.body, candidates, morphs, outfitEase)
    relaxPose(setup.model, out)
    for (const h of [r.hands.Left, r.hands.Right]) {
      h.armRest.copy(h.arm.quaternion)
      h.foreRest.copy(h.fore.quaternion)
      h.handRest.copy(h.hand.quaternion)
    }
  }, [morphs, outfitEase, setup, candidates, rigVersion])

  /* ---- render validation: the doll is drawn only once every layer it wears is attached ---- */
  const expectedRef = useRef<string[]>([])
  const waitSince = useRef(0)
  const layersComplete = () => {
    if (expectedRef.current.every((src) => attachedSrc.current.has(src))) {
      waitSince.current = 0
      return true
    }
    // a layer that can't arrive is swapped back by its error boundary; never hide her for long
    const now = performance.now()
    if (!waitSince.current) waitSince.current = now
    return now - waitSince.current > 4000
  }
  const expected = useMemo(() => {
    const want: string[] = []
    const hasHair = (id: string) => catalog.hair.some((h) => h.id === id)
    const ch = look.hair.care.change
    if (look.hair.care.bonnet && hasHair('bonnet')) want.push(url.hair('bonnet'))
    else if (ch && hasHair(ch.from) && hasHair(ch.to)) want.push(url.hair(ch.from), url.hair(ch.to))
    else if (look.hair.style !== 'none' && hasHair(look.hair.style)) want.push(url.hair(look.hair.style))
    const o = catalog.outfits.find((x) => x.id === look.outfit.id) ?? catalog.outfits[0]
    const sh = catalog.shoes.find((x) => x.id === look.shoes.id) ?? catalog.shoes[0]
    if (o) want.push(url.outfit(o.id))
    if (sh) want.push(url.shoes(sh.id))
    return want
  }, [catalog, look.hair.care.bonnet, look.hair.care.change, look.hair.style, look.outfit.id, look.shoes.id])
  useLayoutEffect(() => void (expectedRef.current = expected), [expected])

  /* ---- per frame: idle → routine → expressions → skin/nails/patches/props ---- */
  const frame = useRef<FrameState>({ blink: { next: 2.5, t: -1 }, exprW: Object.fromEntries(EXPRESSIONS.map((e) => [e, 0])) as Record<ExpressionId, number>, inv: new Matrix4() })
  const lookRef = useRef(look)
  lookRef.current = look
  const clinicRef = useRef(clinic)
  clinicRef.current = clinic
  const poseRef = useRef({ pose, expression })
  poseRef.current = { pose, expression }

  useFrame(({ clock }, dt) =>
    frameUpdate(frame.current, {
      t: clock.elapsedTime,
      dt,
      animate,
      setup,
      rig: rigRef.current,
      look: lookRef.current,
      clinic: clinicRef.current,
      pose: poseRef.current.pose,
      expression: poseRef.current.expression,
      morphMeshes,
      care: catalog.care,
      char: charRef.current,
      remote,
      complete: layersComplete(),
    }),
  )

  // Hide skin under clothes and shoes (masks from the build).
  const setHide = (slot: 0 | 1) => (t: Texture | null) => {
    if (!setup.skin) return
    if (slot === 0) setup.skin.uHide0.value = t
    else setup.skin.uHide1.value = t
    setup.skin.uHideOn.value.setComponent(slot, t ? 1 : 0)
  }

  // Preloaded modules swap in the same frame; anything still downloading keeps the old one on
  // screen until it arrives (no flash of bare skin, never a half-dressed doll).
  const dHair = useDeferredValue(look.hair.style)
  const dOutfit = useDeferredValue(look.outfit.id)
  const dShoe = useDeferredValue(look.shoes.id)
  const hairId = look.hair.style === 'none' || loadedModules.has(url.hair(look.hair.style)) ? look.hair.style : dHair
  const outfitId = loadedModules.has(url.outfit(look.outfit.id)) ? look.outfit.id : dOutfit
  const shoeId = loadedModules.has(url.shoes(look.shoes.id)) ? look.shoes.id : dShoe
  // never a half-dressed doll: an outfit or shoes this build doesn't have falls back to one it does
  const outfit = catalog.outfits.find((o) => o.id === outfitId) ?? catalog.outfits[0]
  const shoes = catalog.shoes.find((s) => s.id === shoeId) ?? catalog.shoes[0]
  const has = (id: string) => catalog.hair.some((h) => h.id === id)
  const change = look.hair.care.change
  const bonnet = look.hair.care.bonnet && has('bonnet')
  const failed = (what: 'hair' | 'outfit' | 'shoes') => () => {
    const s = useStudio.getState()
    s.notify(`That ${what === 'hair' ? 'hairstyle' : what === 'outfit' ? 'outfit' : 'pair of shoes'} couldn’t load. Your current look is safe.`, 'error')
    s.apply((l) => {
      if (what === 'hair') l.hair.style = (good.current.hair as HairId | null) ?? 'none'
      else if (what === 'outfit' && good.current.outfit) l.outfit.id = good.current.outfit as StudioLook['outfit']['id']
      else if (what === 'shoes' && good.current.shoes) l.shoes.id = good.current.shoes as StudioLook['shoes']['id']
    })
  }

  return (
    <group scale={look.height}>
      <primitive object={setup.model} />
      {/* each hair module loads on its own: a slow or failed hairstyle never blanks the doll */}
      {bonnet && (
        <Suspense key="bonnet" fallback={null}>
          <HairModule id="bonnet" base={setup.model} registry={registry} look={look} head={setup.head} headLocalC={setup.headLocalC} wetAs="bonnet" clinic={clinic} />
        </Suspense>
      )}
      {!bonnet && change && has(change.from) && has(change.to) ? (
        <>
          <Suspense key={`from:${change.from}`} fallback={null}>
            <HairModule id={change.from} base={setup.model} registry={registry} look={look} head={setup.head} headLocalC={setup.headLocalC} mode={2} dir={change.kind === 'retwist' ? 1 : 0} wetAs={change.from} clinic={clinic} />
          </Suspense>
          <Suspense key={`to:${change.to}`} fallback={null}>
            <HairModule id={change.to} base={setup.model} registry={registry} look={look} head={setup.head} headLocalC={setup.headLocalC} mode={1} dir={change.kind === 'retwist' ? 1 : 0} wetAs={change.to} clinic={clinic} />
          </Suspense>
        </>
      ) : (
        !bonnet &&
        hairId !== 'none' &&
        has(hairId) && (
          <ModuleBoundary key={hairId} src={url.hair(hairId)} onFail={failed('hair')}>
            <HairModule id={hairId} base={setup.model} registry={registry} look={look} head={setup.head} headLocalC={setup.headLocalC} wetAs={hairId} clinic={clinic} onLoaded={(id) => (good.current.hair = id)} />
          </ModuleBoundary>
        )
      )}
      {outfit && (
        <ModuleBoundary key={outfit.id} src={url.outfit(outfit.id)} onFail={failed('outfit')}>
          <OutfitModule src={url.outfit(outfit.id)} mask={outfit.hideMask ? url.mask(`hide_${outfit.id}`) : null} base={setup.model} registry={registry} onMask={setHide(0)} dye={look.outfit} onLoaded={() => (good.current.outfit = outfit.id)} />
        </ModuleBoundary>
      )}
      {shoes && (
        <ModuleBoundary key={shoes.id} src={url.shoes(shoes.id)} onFail={failed('shoes')}>
          <OutfitModule src={url.shoes(shoes.id)} mask={shoes.hideMask ? url.mask(`hide_${shoes.id}`) : null} base={setup.model} registry={registry} onMask={setHide(1)} onLoaded={() => (good.current.shoes = shoes.id)} />
        </ModuleBoundary>
      )}
    </group>
  )
}

useGLTF.preload(url.body, false, true)
