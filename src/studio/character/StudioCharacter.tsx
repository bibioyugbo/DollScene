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
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type Bone,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
  CanvasTexture,
  type Texture,
} from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { clinicEffect, effectiveMorphs } from '../../shared/studio/clinic'
import { ALL_MORPHS, EXPRESSIONS, PIECE_SLOTS, SPOT_IDS, TATTOO_SPOTS, type ClinicId, type ExpressionId, type HairId, type MorphId, type PieceSlot, type SpotId, type StudioLook, type Worn } from '../../shared/studio/look'
import { actionProps, getCharacter, headNormal, headUp, isRunning, landmarkNormal, setCharacter, stepActions, type Character } from '../actions/engine'
import { fx } from '../state/fx'
import { useStudio, type ExpressionPreset } from '../state/store'
import { attachModule } from '../../three/doll/attachModule'
import { url, wearables, type CharacterCatalog, type Wearable } from './catalog'
import { applyHairFrame, applyHairLook, isHairMaterial, PARTED, setupHairMaterial, wetResponse, type HairUniforms } from './hairMaterial'
import { buildExtras, buildJewellery } from './jewellery'
import { applyNailFx, applyNailLook, buildNails, nailPoints, type NailSet } from './nails'
import { idleRig, idleTick, relaxPose } from './pose'
import { applyPose, EXPRESSION_WEIGHTS, POSE_FACE, POSE_PROPS, poseUsesHand, type Carry, type PoseKey } from './poses'
import { propSlot, updateProp, type PropSlot, type PropState } from './props'
import { bindLandmarks, buildHandRig, landmarkWorld, setGrip, type Grip, type HandRig, type LandmarkSource, type Side } from './rig'
import { applyLookToSkin, createSkinMaterial, HidePack, skinColor, type SkinUniforms } from './skinMaterial'
import { TattooLayer } from './tattoos'
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
/**
 * The same eyes, bloodshot: a pink wash over the whites and fine red veins running in from the
 * corners toward the iris (the iris itself untouched). The texture holds two eyeballs; their
 * centres and sizes are fixed by the MakeHuman eye map.
 */
const redEyes = new Map<string, Promise<Texture>>()
export function bloodshotTexture(id: string) {
  let p = redEyes.get(id)
  if (!p) {
    p = eyeTexture(id).then((t) => {
      const img = t.image as HTMLImageElement | ImageBitmap
      const W = img.width
      const cv = document.createElement('canvas')
      cv.width = cv.height = W
      const g = cv.getContext('2d')!
      g.drawImage(img, 0, 0)
      let seed = 7
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
      for (const [cx, cy] of [
        [0.703, 0.297],
        [0.289, 0.711],
      ]) {
        const x0 = cx * W
        const y0 = cy * W
        const iris = 0.118 * W
        const ball = 0.29 * W
        // the whites flush pink, strongest toward the corners
        const wash = g.createRadialGradient(x0, y0, iris * 1.05, x0, y0, ball)
        wash.addColorStop(0, 'rgba(232,110,112,0.22)')
        wash.addColorStop(0.55, 'rgba(214,70,76,0.42)')
        wash.addColorStop(1, 'rgba(190,40,50,0.58)')
        g.fillStyle = wash
        g.beginPath()
        g.arc(x0, y0, ball, 0, Math.PI * 2)
        g.arc(x0, y0, iris * 1.05, 0, Math.PI * 2, true)
        g.fill()
        // veins: branching, wiggly, thinning toward the iris
        g.lineCap = 'round'
        for (let v = 0; v < 40; v++) {
          let a = rnd() * Math.PI * 2
          let r = ball * (0.92 + rnd() * 0.06)
          const w = W * (0.0045 + rnd() * 0.003)
          g.strokeStyle = `rgba(${170 + Math.floor(rnd() * 40)},${20 + Math.floor(rnd() * 25)},${30 + Math.floor(rnd() * 20)},${0.55 + rnd() * 0.3})`
          g.beginPath()
          g.moveTo(x0 + Math.cos(a) * r, y0 + Math.sin(a) * r)
          const stop = iris * (1.25 + rnd() * 0.6)
          while (r > stop) {
            r -= W * 0.012
            a += (rnd() - 0.5) * 0.18
            g.lineTo(x0 + Math.cos(a) * r, y0 + Math.sin(a) * r)
          }
          g.lineWidth = w
          g.stroke()
        }
      }
      const out = new CanvasTexture(cv)
      out.flipY = false
      out.colorSpace = SRGBColorSpace
      return out
    })
    p.catch(() => redEyes.delete(id))
    redEyes.set(id, p)
  }
  return p
}

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

/** Her colour on a hair module's materials, and the part line in her own scalp tone (skin renders
 * at ~0.72 x the tone: the body map is a 0.72 detail map; the scalp a touch deeper). */
function tintHair(mat: MeshStandardMaterial, u: HairUniforms, l: StudioLook) {
  applyHairLook(mat, u, l.hair)
  skinColor(l.skin.tone, l.skin.undertone, u.uPartColor.value).multiplyScalar(0.68)
}

function HairModule({ id, base, registry, look, head, headLocalC, mode = 0, dir = 0, wetAs, clinic, onLoaded }: HairModuleProps) {
  const tinted = useRef<{ mat: MeshStandardMaterial; u: HairUniforms }[]>([])
  const meshes = useRef<Mesh[]>([])
  const lookRef = useRef(look)
  lookRef.current = look
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
        const u = setupHairMaterial(mat, c)
        if (PARTED.includes(id) && sm.isSkinnedMesh && head) {
          // mesh units per metre (the module's geometry is quantised)
          const a = boneLocalToMeshSpace(sm, head, headLocalC)
          const b = boneLocalToMeshSpace(sm, head, headLocalC.clone().add(new Vector3(0.1, 0, 0)))
          if (a && b) u.uPart.value = [1, 0.0012, a.distanceTo(b) / 0.1, 0]
        }
        tinted.current.push({ mat, u })
        // modules are pooled between dolls: colour it for THIS doll now (the effect below may
        // already have run before the module attached, and would leave the last wearer's colour)
        tintHair(mat, u, lookRef.current)
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
    for (const { mat, u } of tinted.current) tintHair(mat, u, look)
  }, [look.hair, look.skin.tone, look.skin.undertone, id])
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

const ROUGH: Record<string, number> = { cotton: 0.8, satin: 0.36, denim: 0.9, sequin: 0.3, velvet: 0.7, lace: 0.7, net: 0.7, leather: 0.42, patent: 0.16 }

/**
 * One worn piece. Pieces (material "Piece_<finish>") are recoloured through three colour slots:
 * their texture holds R = detail (0.72 = the colour itself), G = where the secondary colour goes,
 * B = the accent, A = holes, so one asset is every colourway. Classic MakeHuman sets ("Fabric")
 * take one tint over their own print.
 */
function WearModule({ item, colors, base, registry, onMask, onLoaded }: { item: Wearable; colors: Worn['colors']; base: Object3D; registry: Registry; onMask: (t: Texture | null) => void; onLoaded?: () => void }) {
  const hide = useTexture(item.mask ?? url.mask('body'))
  const mats = useRef<MeshStandardMaterial[]>([])
  const colorsRef = useRef(colors)
  colorsRef.current = colors
  useModule(
    item.src,
    base,
    registry,
    (meshes) => {
      mats.current = []
      if (item.slot === 'bottom') setBottom(base, meshes)
      for (const mesh of meshes) {
        const mat = mesh.material as MeshStandardMaterial
        mats.current.push(mat)
        // the colour uniforms live on the material (modules are pooled and reused by every doll
        // that wears this piece: per-component uniforms would keep the first wearer's colours)
        const uniforms = (mat.userData.dsU ??= { uP: { value: new Color() }, uS: { value: new Color() }, uA: { value: new Color() }, uDye: { value: new Color() }, uDyeAmount: { value: 0 } }) as WearUniforms
        setWearColors(uniforms, colorsRef.current)
        const name = mat.name.replace(/\.\d+$/, '')
        const piece = name.startsWith('Piece_')
        const finish = piece ? name.slice(6) : name.replace(/^Fabric_?/, '')
        const holes = finish === 'net' || finish === 'lace'
        mat.alphaTest = finish === 'net' ? 0.5 : 0.4
        mat.transparent = false
        // The glTF loader turns depth writes off for alpha-blend materials; as an opaque cutout the
        // garment must write depth, or later transparent passes (the studio floor, a scene's water
        // or shadows) draw straight over it and the legs look see-through.
        mat.depthWrite = true
        // Front faces only for closed shells (double-sided drawing let the inside of the fabric win
        // the depth test at the shoulders); lace, mesh and shoes (open uppers) show both sides.
        mat.side = holes || item.slot === 'shoes' ? DoubleSide : FrontSide
        mat.roughness = ROUGH[finish] ?? 0.75
        mat.metalness = finish === 'sequin' ? 0.35 : 0
        if (piece && mat.map) {
          // the slot masks are data, not colour
          mat.map.colorSpace = NoColorSpace
          mat.map.needsUpdate = true
          mat.color.setRGB(1, 1, 1)
        }
        const tucked = item.slot === 'top' && TUCKED.has(item.id)
        mat.onBeforeCompile = (shader) => {
          Object.assign(shader.uniforms, uniforms)
          if (tucked) {
            // tucked in: below the trousers' or skirt's waistband this top is inside them
            shader.uniforms.uTuck = tuckOf(base)
            shader.vertexShader = shader.vertexShader
              .replace('#include <common>', '#include <common>\nvarying float vDsWy;')
              .replace('#include <project_vertex>', '#include <project_vertex>\nvDsWy = (modelMatrix * vec4(transformed, 1.0)).y;')
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nvarying float vDsWy;\nuniform float uTuck;')
              .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vDsWy < uTuck) discard;')
          }
          // Cloth offset: the garment rides ~3.5 mm off the skin (along its skinned normal, in
          // metres, after skinning: the geometry itself is quantised), so small skinning
          // differences between body and fabric at the shoulders and armpits stay under the
          // fabric instead of poking through it. Shoes are rigid and sit where they were built.
          if (item.slot !== 'shoes') shader.vertexShader = shader.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * 0.0035;')
          if (piece)
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uP, uS, uA;').replace(
              '#include <map_fragment>',
              `#ifdef USE_MAP
vec4 dsEnc = texture2D(map, vMapUv);
float dsSec = clamp(dsEnc.g, 0.0, 1.0);
float dsAcc = clamp(dsEnc.b, 0.0, 1.0);
float dsPri = clamp(1.0 - dsSec - dsAcc, 0.0, 1.0);
vec3 dsSlot = (uP * dsPri + uS * dsSec + uA * dsAcc) / max(dsPri + dsSec + dsAcc, 0.001);
diffuseColor.rgb *= dsSlot * (dsEnc.r / 0.72);
diffuseColor.a *= dsEnc.a;
#endif`,
            )
          else
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform vec3 uDye;\nuniform float uDyeAmount;')
              .replace(
                '#include <map_fragment>',
                '#include <map_fragment>\nfloat dsL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\ndiffuseColor.rgb = mix(diffuseColor.rgb, uDye * (0.25 + dsL * 1.6), uDyeAmount);',
              )
        }
        mat.customProgramCacheKey = () => (piece ? (tucked ? 'dollscene-piece-tuck' : 'dollscene-piece') : 'dollscene-fabric-dye')
        mat.needsUpdate = true
      }
    },
    () => {
      onLoaded?.()
      const meshesNow = base.userData.dsBottom
      const clearBottom = () => {
        if (item.slot === 'bottom') setBottom(base, null, meshesNow)
      }
      if (!item.mask) return clearBottom
      onMask(maskTex(hide))
      return () => (onMask(null), clearBottom())
    },
  )
  useLayoutEffect(() => {
    for (const m of mats.current) if (m.userData.dsU) setWearColors(m.userData.dsU as WearUniforms, colors)
  }, [colors])
  return null
}

/** Fitted tops worn tucked into whatever bottom she wears. */
const TUCKED = new Set(['top_tank', 'top_cami', 'top_corset', 'top_mesh', 'top_sports_bra', 'top_lace_bralette', 'top_crop_tank', 'top_baby_tee', 'top_bandeau', 'top_crop_tee'])
/** The bottom a doll wears right now (its meshes), for the tuck line. `only`: clear only if still these. */
function setBottom(base: Object3D, meshes: Mesh[] | null, only?: unknown) {
  if (only !== undefined && base.userData.dsBottom !== only) return
  base.userData.dsBottom = meshes
}
/** The shared tuck line (world y; far below = off) of one doll. */
function tuckOf(base: Object3D): { value: number } {
  return (base.userData.dsTuck ??= { value: -1e6 })
}
const tv = new Vector3()
/** Lowest point of the bottom's waistband (model space), from its live, skinned vertices. */
function waistbandY(model: Object3D, meshes: Mesh[]) {
  const toModel = new Matrix4().copy(model.matrixWorld).invert()
  const top = new Array(12).fill(-Infinity)
  for (const m of meshes) {
    const sm = m as SkinnedMesh
    const pos = sm.geometry.attributes.position
    for (let i = 0; i < pos.count; i += 2) {
      sm.getVertexPosition(i, tv)
      tv.applyMatrix4(sm.matrixWorld).applyMatrix4(toModel)
      if (tv.y < 0.7) continue
      const k = Math.floor(((Math.atan2(tv.x, tv.z) + Math.PI) / (Math.PI * 2)) * 12) % 12
      if (tv.y > top[k]) top[k] = tv.y
    }
  }
  const ok = top.filter((y) => Number.isFinite(y))
  return ok.length ? Math.min(...ok) : null
}

type WearUniforms = { uP: { value: Color }; uS: { value: Color }; uA: { value: Color }; uDye: { value: Color }; uDyeAmount: { value: number } }
function setWearColors(u: WearUniforms, colors: Worn['colors']) {
  u.uP.value.set(colors[0])
  u.uS.value.set(colors[1])
  u.uA.value.set(colors[2])
  // classics: white means "as made"; any other colour dyes it
  u.uDye.value.set(colors[0])
  u.uDyeAmount.value = colors[0].toUpperCase() === '#FFFFFF' ? 0 : 0.75
}

/** Hide-mask slot on the skin shader for each wardrobe slot. */
const HIDE_SLOT: Record<PieceSlot, 0 | 1 | 2 | 3> = { top: 0, bottom: 1, dress: 2, shoes: 3 }

/**
 * Pitch the feet for heeled shoes: the foot bones toes-down by `arch` about the ankle, the toe
 * bones back by the same so the toes stay flat (exactly as the shoe was modelled: shoes.py).
 */
const qa = new Quaternion()
const qw = new Quaternion()
const axX = new Vector3(1, 0, 0)
function archFeet(model: Object3D, rest: Map<string, Quaternion>, arch: number) {
  for (const side of ['Left', 'Right'] as const) {
    for (const [name, ang] of [
      [`${side}Foot`, arch],
      [`${side}ToeBase`, -arch],
    ] as const) {
      const b = model.getObjectByName(name) as Bone | undefined
      const r = rest.get(name)
      if (!b || !r) continue
      b.quaternion.copy(r)
      if (!ang) continue
      b.updateWorldMatrix(true, false)
      // a rotation about the model's X axis (her left-right) through the joint, in world space
      const parentQ = b.parent!.getWorldQuaternion(new Quaternion())
      const worldQ = b.getWorldQuaternion(qw)
      const rootQ = model.getWorldQuaternion(new Quaternion())
      qa.setFromAxisAngle(axX.clone().applyQuaternion(rootQ), ang)
      b.quaternion.copy(parentQ.invert().multiply(qa).multiply(worldQ))
      b.updateWorldMatrix(false, true)
    }
  }
}

/** What she carries in her left hand, and how it's held. */
const HELD_PROP: Record<string, PropState> = {
  whip: { id: 'whip', hold: 'grip' },
  joint: { id: 'joint', hold: 'fingers' },
  clutch: { id: 'clutch', hold: 'grip' },
  fan: { id: 'fan', hold: 'grip' },
  matcha: { id: 'matcha', hold: 'cup' },
  phone: { id: 'phone', hold: 'grip' },
}
/** How the free arm carries each item (poses.ts carryGoal). */
const HELD_CARRY: Partial<Record<string, Carry>> = { matcha: 'cup', phone: 'phone', joint: 'joint' }
const HELD_GRIP: Record<PropState['hold'], Grip> = { fingers: 'peace', cup: 'wrap', flatPhone: 'flat', grip: 'hold', palm: 'hold', pinch: 'pinch' }

/* ------------------------------------------------------------------ patches */

const patchGeo = new SphereGeometry(0.012, 18, 4, 0, Math.PI * 2, 0, 0.47).translate(0, -0.012 * Math.cos(0.47), 0)
const patchMat = new MeshPhysicalMaterial({ color: '#e3cdb4', roughness: 0.28, transparent: true, opacity: 0.6, depthWrite: false, sheen: 0.4, sheenColor: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2 })

/**
 * A hydrogel under-eye patch: a crescent ~3.4 cm across, its top edge following the lower lash
 * line and rising a touch toward the outer corner (+x), bent to the cheek's curve.
 */
const eyePatchGeo = (() => {
  const s = new Shape()
  s.moveTo(-0.0165, 0.0015)
  s.quadraticCurveTo(0, -0.0035, 0.0165, 0.0045)
  s.quadraticCurveTo(0.0125, -0.0115, 0, -0.0128)
  s.quadraticCurveTo(-0.012, -0.0118, -0.0165, 0.0015)
  const g = new ShapeGeometry(s, 14)
  const p = g.attributes.position
  for (let k = 0; k < p.count; k++) p.setZ(k, -(p.getX(k) ** 2) / (2 * 0.045) - (p.getY(k) ** 2) / (2 * 0.09))
  g.computeVertexNormals()
  return g
})()
const eyePatchMat = new MeshPhysicalMaterial({ color: '#f5b3c3', roughness: 0.2, transparent: true, opacity: 0.74, depthWrite: false, side: DoubleSide, clearcoat: 0.6, sheen: 0.5, sheenColor: '#fff2d6', polygonOffset: true, polygonOffsetFactor: -2 })
const ex = new Vector3()
const ey = new Vector3()
const ez = new Vector3()
const em = new Matrix4()
const eq = new Quaternion()

const pv = new Vector3()
const pn = new Vector3()
const pside = new Vector3()
const pq = new Quaternion()
const yAxis = new Vector3(0, 1, 0)

/* ------------------------------------------------------------------ per frame */

interface FrameState {
  tuckKey: string
  tuckWait: number
  tuckY: number | null
  blink: { next: number; t: number }
  exprW: Record<ExpressionId, number>
  inv: Matrix4
}

interface RigParts {
  hands: Record<Side, HandRig> | null
  landmarks: LandmarkSource
  nails: NailSet | null
  patches: Map<SpotId, Mesh>
  eyePatches: Record<'L' | 'R', Mesh>
  props: Record<Side, PropSlot>
  propRoot: Group
}

interface FrameInput {
  t: number
  dt: number
  animate: boolean
  setup: { idle: ReturnType<typeof idleRig>; model: Object3D; skin: SkinUniforms | null; tattoo: TattooLayer | null }
  rig: RigParts | null
  look: StudioLook
  clinic: Partial<Record<ClinicId, number>>
  pose: PoseKey | null
  expression: ExpressionPreset | null
  morphMeshes: Set<Mesh>
  care: CharacterCatalog['care']
  /** This doll's own character rig (hands, landmarks). */
  char: Character | null
  remote: boolean
  /** Every layer (body, hair, outfit, shoes) attached: until then the doll isn't drawn. */
  complete: boolean
  /** Changes whenever her shape changes (re-measure anything fitted to it). */
  morphKey: string
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
  if (!running && mine) applyPose(c!, i.pose ?? 'relaxed', t, dt, HELD_CARRY[l.extras.held] ?? null)

  // expressions: the routine/photo-mode weights, the morning face and a natural blink
  const want = i.remote ? {} : useStudio.getState().expression
  const photo = !running && i.expression ? EXPRESSION_WEIGHTS[i.expression] : null
  const w = f.exprW
  for (const e of EXPRESSIONS) w[e] = want[e] ?? photo?.[e] ?? 0
  const poseFace = !running && i.pose ? POSE_FACE[i.pose]?.(t) : null
  if (poseFace) for (const [e, v] of Object.entries(poseFace) as [ExpressionId, number][]) w[e] = Math.max(w[e], v)
  if (l.care.morning) w.Expr_Sleepy = Math.max(w.Expr_Sleepy, 0.75)
  // a joint in hand: low, heavy lids (the red eyes are in the eye texture)
  if (l.extras.held === 'joint') w.Expr_Sleepy = Math.max(w.Expr_Sleepy, 0.62)
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
  // tucked tops: the line is the bottom's waistband (re-measured when what she wears or her shape changes)
  const tuck = tuckOf(setup.model)
  const bottomMeshes = setup.model.userData.dsBottom as Mesh[] | null | undefined
  const tKey = l.wear.top && TUCKED.has(l.wear.top.id) && bottomMeshes ? `${l.wear.bottom?.id}:${i.morphKey}` : ''
  if (tKey !== f.tuckKey) {
    f.tuckKey = tKey
    f.tuckWait = 3
    tuck.value = -1e6
  }
  if (tKey && f.tuckWait > 0 && --f.tuckWait === 0) f.tuckY = waistbandY(setup.model, bottomMeshes!)
  if (tKey && f.tuckWait === 0 && f.tuckY !== null) tuck.value = tv.set(0, f.tuckY - 0.006, 0).applyMatrix4(setup.model.matrixWorld).y
  if (setup.skin && setup.tattoo) {
    const inked = setup.tattoo.update(l.tattoos, i.care, i.remote ? {} : fx.tattoo.fade)
    setup.skin.uTattoo.value = setup.tattoo.texture
    setup.skin.uTattooFx.value.set(inked ? 1 : 0, 0, i.remote ? 0 : fx.tattoo.fresh, 0)
  }

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
  // under-eye patches: on the under-eye hollow, shaped to it, until peeled (from the inner corner,
  // the outer edge lifting away first)
  for (const side of ['L', 'R'] as const) {
    const mesh = r.eyePatches[side]
    const peel = fx.skin.eyePeel[side]
    mesh.visible = mine && !!l.care.eyePatches && peel < 0.999 && !!c
    if (!mesh.visible || !c) continue
    const key = `underEye${side}` as const
    const pts = c.care.strokes[key]
    const mid = pts?.length ? landmarkWorld(c.landmarks, `stroke:${key}:${pts.length >> 1}`, pv) : null
    if (!mid) {
      mesh.visible = false
      continue
    }
    ez.copy(landmarkNormal(c, key))
    ey.copy(headUp(c)).addScaledVector(ez, -headUp(c).dot(ez)).normalize()
    // ex points to her left; her right eye's patch is mirrored (scale x -1), so its outer corner
    // (+x) points out toward that temple too
    ex.crossVectors(ey, ez).normalize()
    const outward = side === 'R' ? -1 : 1
    pv.addScaledVector(ez, 0.0013).addScaledVector(ey, 0.0015)
    em.makeBasis(ex, ey, ez)
    eq.setFromRotationMatrix(em)
    if (peel > 0) {
      const hinge = pv.clone().addScaledVector(ex, -0.016 * outward)
      const rot = new Quaternion().setFromAxisAngle(ey, (side === 'R' ? 1 : -1) * Math.min(1, peel / 0.7) * 1.7)
      pv.sub(hinge).applyQuaternion(rot).add(hinge)
      eq.premultiply(rot)
    }
    em.compose(pv, eq, side === 'R' ? flipX : one)
    mesh.matrix.multiplyMatrices(f.inv, em)
    mesh.matrixWorldNeedsUpdate = true
  }
  if (r.hands) {
    const held = running ? actionProps : (i.pose && POSE_PROPS[i.pose]) || NO_PROPS
    let left = held.Left ?? null
    // what she carries (a whisk, a joint...) stays in her left hand unless a routine or the pose needs it
    const carry = l.extras.held !== 'none' ? HELD_PROP[l.extras.held] : null
    if (carry && !running && !left && !poseUsesHand(i.pose, 'Left')) {
      left = carry
      setGrip(r.hands.Left, HELD_GRIP[carry.hold], 1)
    }
    updateProp(r.props.Left, r.hands.Left, left, f.inv, t)
    updateProp(r.props.Right, r.hands.Right, held.Right ?? null, f.inv, t)
  }
}

const one = new Vector3(1, 1, 1)
const flipX = new Vector3(-1, 1, 1)
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
  pose?: PoseKey | null
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
      for (const k of TATTOO_SPOTS) {
        const a = care.tattoos?.[k]
        if (a) points[`tat:${k}`] = a.p
      }
      for (const k of ['industrialAL', 'industrialBL', 'industrialAR', 'industrialBR']) {
        const a = care.jewellery[k]
        if (a) points[`jw:${k}`] = a.p
      }
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
    // the feet's rest rotations (heels pitch them from here)
    const footRest = new Map<string, Quaternion>()
    for (const n of ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase']) {
      const b = model.getObjectByName(n)
      if (b) footRest.set(n, b.quaternion.clone())
    }
    const tattoo = skin ? new TattooLayer() : null
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
      footRest,
      tattoo,
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
    ;(look.extras.held === 'joint' ? bloodshotTexture(look.eyes.iris) : eyeTexture(look.eyes.iris)).then(
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
  }, [look.eyes.iris, look.extras.held === 'joint', setup])

  /* ---- hands, landmarks, nails, patches, props: everything that needs the bound body ---- */
  const rigRef = useRef<RigParts | null>(null)
  const charRef = useRef<Character | null>(null)
  const [rigVersion, setRigVersion] = useState(0)
  const hairMeshes = useRef<() => Mesh[]>(() => [])
  // the last modules that really loaded (to fall back to if a new one fails)
  const good = useRef<{ hair: string | null; wear: Partial<Record<PieceSlot, Worn | null>> }>({ hair: null, wear: {} })
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
    const eyeMesh = () => {
      const m = new Mesh(eyePatchGeo, eyePatchMat)
      Object.assign(m, { visible: false, frustumCulled: false, matrixAutoUpdate: false, renderOrder: 2 })
      propRoot.add(m)
      return m
    }
    const eyePatches = { L: eyeMesh(), R: eyeMesh() }
    const props = { Left: propSlot(), Right: propSlot() }
    propRoot.add(props.Left.group, props.Right.group)
    model.add(propRoot)
    const headRestQ = head.getWorldQuaternion(new Quaternion())
    rigRef.current = { hands: left && right ? { Left: left, Right: right } : null, nails, patches, eyePatches, props, propRoot, landmarks }
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
  // Necklaces and chains drape over a top or dress (always on the outside of clothing).
  const dressed = !!(look.wear.top || look.wear.dress)
  useEffect(() => {
    const r = rigRef.current
    const care = catalog.care
    if (!r || !care) return
    // fit on the next frame, once the renderer has posed and scaled the new doll
    let set: ReturnType<typeof buildJewellery> | null = null
    const id = requestAnimationFrame(() => (set = buildJewellery(setup.model, care, r.landmarks, look.jewellery, dressed)))
    return () => {
      cancelAnimationFrame(id)
      set?.dispose()
    }
    // refit when her face, height or the clinic changes the shape the pieces sit on
  }, [look.jewellery, morphs, look.height, setup, catalog.care, rigVersion, dressed])

  // Accessories (headband, coral, waist beads, pins, chains) likewise, sized from her live body.
  const items = useMemo(() => wearables(catalog), [catalog])
  const shoeItem = look.wear.shoes ? items.get(look.wear.shoes.id) : undefined
  const arch = shoeItem?.arch ?? 0
  const lift = shoeItem?.lift ?? 0
  useEffect(() => {
    const r = rigRef.current
    const care = catalog.care
    if (!r || !care) return
    let set: ReturnType<typeof buildExtras> | null = null
    const id = requestAnimationFrame(() => (set = buildExtras(setup.model, care, r.landmarks, look.extras, look.jewellery, dressed)))
    return () => {
      cancelAnimationFrame(id)
      set?.dispose()
    }
  }, [look.extras, look.jewellery, morphs, look.height, arch, setup, catalog.care, rigVersion, dressed])

  // Heels: feet pitched to the shoe's arch, the whole doll raised by its heel height.
  // Long, slender legs: the thighs (and the shins with them) lengthen along the bone, and the whole
  // doll rises so her feet stay on the floor. Men most (their base is a tall, long-legged man),
  // slender women a little, fat bodies not at all. Clothes are skinned to the same bones.
  const legK = (look.morphs.Softness ?? 0.5) >= 0.75 ? 1 : (look.morphs.Masc ?? 0.5) >= 1 ? 1.07 : 1.04
  useLayoutEffect(() => {
    const model = setup.model
    archFeet(model, setup.footRest, arch)
    model.position.setY(0)
    model.updateMatrixWorld(true)
    const foot = model.getObjectByName('LeftFoot')
    const before = foot ? foot.getWorldPosition(new Vector3()).y : 0
    for (const n of ['LeftUpLeg', 'RightUpLeg']) model.getObjectByName(n)?.scale.set(1, legK, 1)
    model.updateMatrixWorld(true)
    const after = foot ? foot.getWorldPosition(new Vector3()).y : 0
    model.position.setY(lift + (before - after) / Math.max(1e-6, model.parent ? model.parent.getWorldScale(new Vector3()).y : 1))
    model.updateMatrixWorld(true)
  }, [arch, lift, setup, legK])

  /* ---- relaxed arms rest outside her hips (and skirt), however full her figure ---- */
  // a skirt's flare at the hands, capped: arms rest on the fabric, they don't hover a hand's width out
  const outfitEase = Math.min(0.035, Math.max(0, ...(['top', 'bottom', 'dress'] as const).map((k) => (look.wear[k] ? (items.get(look.wear[k]!.id)?.ease ?? 0) * 0.5 : 0))))
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
    for (const slot of PIECE_SLOTS) {
      const it = look.wear[slot] ? items.get(look.wear[slot]!.id) : undefined
      if (it) want.push(it.src)
    }
    return want
  }, [catalog, items, look.hair.care.bonnet, look.hair.care.change, look.hair.style, look.wear])
  useLayoutEffect(() => void (expectedRef.current = expected), [expected])

  /* ---- per frame: idle → routine → expressions → skin/nails/patches/props ---- */
  const frame = useRef<FrameState>({ tuckKey: '', tuckWait: 0, tuckY: null, blink: { next: 2.5, t: -1 }, exprW: Object.fromEntries(EXPRESSIONS.map((e) => [e, 0])) as Record<ExpressionId, number>, inv: new Matrix4() })
  const lookRef = useRef(look)
  lookRef.current = look
  const clinicRef = useRef(clinic)
  clinicRef.current = clinic
  const morphKeyRef = useRef('')
  morphKeyRef.current = useMemo(() => JSON.stringify([morphs, look.height]), [morphs, look.height])
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
      morphKey: morphKeyRef.current,
    }),
  )

  // Hide skin under clothes and shoes (masks from the build).
  const hidePack = useMemo(() => new HidePack(), [])
  useEffect(() => () => hidePack.texture.dispose(), [hidePack])
  const setHide = (slot: 0 | 1 | 2 | 3) => (t: Texture | null) => {
    if (!setup.skin) return
    hidePack.set(slot, t)
    setup.skin.uHide.value = hidePack.texture
    setup.skin.uHideOn.value.setComponent(slot, t ? 1 : 0)
  }

  // Preloaded modules swap in the same frame; anything still downloading keeps the old one on
  // screen until it arrives (no flash of bare skin, never a half-dressed doll).
  const dHair = useDeferredValue(look.hair.style)
  const hairId = look.hair.style === 'none' || loadedModules.has(url.hair(look.hair.style)) ? look.hair.style : dHair
  const has = (id: string) => catalog.hair.some((h) => h.id === id)
  const change = look.hair.care.change
  const bonnet = look.hair.care.bonnet && has('bonnet')
  const failed = (what: 'hair' | PieceSlot) => () => {
    const s = useStudio.getState()
    s.notify(`That ${what === 'hair' ? 'hairstyle' : what === 'shoes' ? 'pair of shoes' : 'piece'} couldn’t load. Your current look is safe.`, 'error')
    s.apply((l) => {
      if (what === 'hair') l.hair.style = (good.current.hair as HairId | null) ?? 'none'
      else l.wear[what] = good.current.wear[what] ?? null
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
      {PIECE_SLOTS.map((slot) => (
        <WearSlot key={slot} slot={slot} worn={look.wear[slot]} items={items} base={setup.model} registry={registry} onMask={setHide(HIDE_SLOT[slot])} onFail={failed(slot)} onLoaded={(w) => (good.current.wear[slot] = w)} />
      ))}
    </group>
  )
}

/**
 * One wardrobe slot. A piece already downloaded swaps in the same frame; one still downloading
 * keeps the previous piece on screen until it arrives (never a half-dressed frame).
 */
function WearSlot({ slot, worn, items, base, registry, onMask, onFail, onLoaded }: { slot: PieceSlot; worn: Worn | null; items: Map<string, Wearable>; base: Object3D; registry: Registry; onMask: (t: Texture | null) => void; onFail: () => void; onLoaded: (w: Worn) => void }) {
  const deferred = useDeferredValue(worn)
  const now = worn ? items.get(worn.id) : undefined
  const shown = !worn || (now && loadedModules.has(now.src)) ? worn : deferred
  const item = shown ? items.get(shown.id) : undefined
  if (!shown || !item || item.slot !== slot) return null
  return (
    <ModuleBoundary key={item.id} src={item.src} onFail={onFail}>
      <WearModule item={item} colors={shown.colors} base={base} registry={registry} onMask={onMask} onLoaded={() => onLoaded(shown)} />
    </ModuleBoundary>
  )
}

useGLTF.preload(url.body, false, true)
