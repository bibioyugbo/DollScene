import { useAnimations, useGLTF } from '@react-three/drei'
import { createPortal, useThree } from '@react-three/fiber'
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Bone,
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  type Material,
  type Object3D,
} from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { tattooCanvas } from '../../data/tattoos'
import type { Appearance, TattooRegion } from '../../shared/types'
import { DRACO_PATH, extendLoader, garmentUrl, type ModelManifest } from '../models'
import { hairTexture, patternTexture } from '../textures'
import { resolveOutfit } from './Clothes'
import { expandTattoos } from './Body'
import { Jewellery } from './Jewellery'

/**
 * Real-asset path. Follows docs/ASSET_SPEC.md:
 *  - base:     public/models/starters/<starterId>.glb  (SkinnedMesh "Body", materials Skin/Eyes/Iris/Lips/Nails, clip "Idle")
 *  - hair:     public/models/hair/<style>.glb          (skinned to the shared skeleton, material "Hair")
 *  - garments: public/models/items/<itemId>.glb or public/models/garments/<template>.glb (material "Fabric")
 *  - sockets:  empties "Socket_<site>_<L|R|C>" parented to bones
 *  - morphs:   "<Name>_Neg" / "<Name>_Pos" pairs; base mesh is the 0.5 neutral
 */

/** Tattoo UV rectangles on the shared body UV layout: [u, v, width, height] in 0..1 (v from top). */
export const TATTOO_UV: Record<TattooRegion, [number, number, number, number]> = {
  face: [0.02, 0.02, 0.2, 0.2],
  neck: [0.24, 0.02, 0.12, 0.1],
  chest: [0.4, 0.02, 0.26, 0.18],
  back: [0.7, 0.02, 0.28, 0.24],
  'shoulder-l': [0.02, 0.26, 0.1, 0.08],
  'shoulder-r': [0.13, 0.26, 0.1, 0.08],
  'arm-l': [0.02, 0.36, 0.1, 0.14],
  'arm-r': [0.13, 0.36, 0.1, 0.14],
  'forearm-l': [0.02, 0.52, 0.1, 0.14],
  'forearm-r': [0.13, 0.52, 0.1, 0.14],
  'hand-l': [0.02, 0.68, 0.1, 0.08],
  'hand-r': [0.13, 0.68, 0.1, 0.08],
  fingers: [0.02, 0.78, 0.21, 0.05],
  ribs: [0.26, 0.24, 0.12, 0.16],
  stomach: [0.4, 0.22, 0.26, 0.16],
  'hip-l': [0.26, 0.42, 0.1, 0.1],
  'hip-r': [0.38, 0.42, 0.1, 0.1],
  'thigh-l': [0.5, 0.42, 0.14, 0.18],
  'thigh-r': [0.66, 0.42, 0.14, 0.18],
  'calf-l': [0.5, 0.62, 0.14, 0.16],
  'calf-r': [0.66, 0.62, 0.14, 0.16],
  'ankle-l': [0.82, 0.62, 0.08, 0.06],
  'ankle-r': [0.9, 0.62, 0.08, 0.06],
  'foot-l': [0.82, 0.7, 0.08, 0.1],
  'foot-r': [0.9, 0.7, 0.08, 0.1],
}

const FACE_MORPHS = ['nose', 'lips', 'jaw', 'cheekbones', 'chin', 'forehead', 'eyeSize', 'eyeSpacing', 'eyeShape', 'brows', 'asymmetry'] as const
const BODY_MORPHS = ['shoulders', 'waist', 'hips', 'bust', 'legs', 'muscle', 'softness'] as const
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

function isMesh(o: Object3D): o is Mesh {
  return (o as Mesh).isMesh === true
}

function ownMaterial(m: Mesh): MeshStandardMaterial | null {
  if (!(m.material instanceof MeshStandardMaterial)) return null
  if (!m.userData.ownMat) {
    m.material = (m.material as Material).clone()
    m.userData.ownMat = true
  }
  return m.material as MeshStandardMaterial
}

/**
 * Re-bind a module's skinned meshes onto the base skeleton by bone name.
 * Extra bones the base lacks (e.g. Hair_*) are re-parented under their nearest
 * matching ancestor so physics/strand bones keep working.
 */
function attachModule(base: Object3D, module: Object3D) {
  const bones = new Map<string, Bone>()
  base.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone)
  })
  const toAdd: Object3D[] = []
  const extraRoots = new Set<Bone>()
  module.traverse((o) => {
    const sm = o as SkinnedMesh
    if (!sm.isSkinnedMesh) return
    const mapped = sm.skeleton.bones.map((b) => {
      const hit = bones.get(b.name)
      if (hit) return hit
      // Find the topmost unmatched ancestor and graft it onto the base.
      let top: Bone = b
      while (top.parent && (top.parent as Bone).isBone && !bones.has(top.parent.name)) top = top.parent as Bone
      extraRoots.add(top)
      return b
    })
    sm.bind(new Skeleton(mapped, sm.skeleton.boneInverses), sm.bindMatrix)
    toAdd.push(sm)
  })
  for (const root of extraRoots) {
    const anchor = root.parent ? bones.get(root.parent.name) : undefined
    ;(anchor ?? base).add(root)
  }
  if (toAdd.length) {
    const g = new Group()
    g.name = `module:${module.name}`
    toAdd.forEach((m) => g.add(m))
    base.add(g)
    return g
  }
  // Rigid module: a root child named "@BoneName" says where to attach.
  const anchor = module.children.find((c) => c.name.startsWith('@'))
  const bone = anchor ? bones.get(anchor.name.slice(1)) : bones.get('Head')
  const clone = module.clone()
  ;(bone ?? base).add(clone)
  return clone
}

/** Socket_<site>_<L|R|C> empties authored on the base model. */
function findSockets(model: Object3D): Map<string, Object3D> {
  const out = new Map<string, Object3D>()
  model.traverse((o) => {
    if (o.name.startsWith('Socket_')) out.set(o.name, o)
  })
  return out
}

function ModuleLoader({ url, base, onReady }: { url: string; base: Object3D; onReady: (o: Object3D) => void }) {
  const gl = useThree((s) => s.gl)
  const gltf = useGLTF(url, DRACO_PATH, true, extendLoader(gl))
  useLayoutEffect(() => {
    const clone = SkeletonUtils.clone(gltf.scene)
    const attached = attachModule(base, clone)
    onReady(attached)
    return () => {
      attached.parent?.remove(attached)
    }
  }, [gltf, base, onReady])
  return null
}

export function GlbDoll({ appearance, manifest, url }: { appearance: Appearance; manifest: ModelManifest; url: string }) {
  const gl = useThree((s) => s.gl)
  const { scene, animations } = useGLTF(url, DRACO_PATH, true, extendLoader(gl))
  const model = useMemo(() => SkeletonUtils.clone(scene), [scene])
  const root = useRef<Group>(null)
  const { actions } = useAnimations(animations, root)

  useEffect(() => {
    const idle = actions.Idle ?? Object.values(actions)[0]
    idle?.reset().fadeIn(0.3).play()
    return () => {
      idle?.fadeOut(0.2)
    }
  }, [actions])

  const items = useMemo(() => resolveOutfit(appearance.outfit), [appearance.outfit])
  const moduleUrls = useMemo(() => {
    const urls: { key: string; url: string; kind: 'hair' | 'item'; itemId?: string }[] = []
    const hair = manifest.hair[appearance.hair.style]
    if (hair) urls.push({ key: `hair:${appearance.hair.style}`, url: hair, kind: 'hair' })
    for (const it of Object.values(items)) {
      const u = garmentUrl(manifest, it.id, it.template)
      if (u) urls.push({ key: `item:${it.id}`, url: u, kind: 'item', itemId: it.id })
    }
    return urls
  }, [manifest, appearance.hair.style, items])

  // Skin, eyes, lips, nails, morphs and tattoos on the base model.
  useLayoutEffect(() => {
    const a = appearance
    const tattoos = expandTattoos(a.tattoos)
    model.traverse((o) => {
      if (!isMesh(o)) return
      // Skinned + morphing meshes outgrow their cached bounds; never cull the doll.
      o.frustumCulled = false
      const mat = ownMaterial(o)
      const name = (o.material as Material).name || ''
      if (mat && /^Skin/i.test(name)) {
        mat.color.set(a.skin.tone)
        mat.roughness = 0.6 - a.skin.glow * 0.25
        if (tattoos.length) {
          const img = (mat.userData.baseImage ??= mat.map?.image) as CanvasImageSource | undefined
          const size = 2048
          const c = document.createElement('canvas')
          c.width = c.height = size
          const g = c.getContext('2d')!
          if (img) g.drawImage(img, 0, 0, size, size)
          else {
            g.fillStyle = '#ffffff'
            g.fillRect(0, 0, size, size)
          }
          for (const t of tattoos) {
            const [u, v, w, h] = TATTOO_UV[t.region]
            const s = 0.4 + t.size * 0.6
            g.save()
            g.globalAlpha = t.opacity * (t.temporary ? 0.72 : 0.92)
            g.translate((u + w / 2) * size, (v + h / 2) * size)
            g.rotate((t.rotation * Math.PI) / 180)
            g.drawImage(tattooCanvas(t.design, t.color, 512), (-w * s * size) / 2, (-h * s * size) / 2, w * s * size, h * s * size)
            g.restore()
          }
          const tex = new CanvasTexture(c)
          tex.colorSpace = SRGBColorSpace
          tex.flipY = false
          mat.map?.dispose?.()
          mat.map = tex
          mat.needsUpdate = true
        }
      }
      if (mat && /^Iris/i.test(name)) mat.color.set(a.face.eyeColor)
      if (mat && /^Lips/i.test(name)) {
        mat.color.set(a.makeup.lipstick ?? new Color(a.skin.tone).multiplyScalar(0.7).getStyle())
        mat.roughness = 0.6 - a.makeup.gloss * 0.45
      }
      if (mat && /^Nails/i.test(name)) mat.color.set(a.nails.color)
      if (o.morphTargetDictionary && o.morphTargetInfluences) {
        const set = (key: string, v: number) => {
          const neg = o.morphTargetDictionary![`${cap(key)}_Neg`]
          const pos = o.morphTargetDictionary![`${cap(key)}_Pos`]
          if (neg !== undefined) o.morphTargetInfluences![neg] = Math.max(0, (0.5 - v) * 2)
          if (pos !== undefined) o.morphTargetInfluences![pos] = Math.max(0, (v - 0.5) * 2)
        }
        for (const k of FACE_MORPHS) set(k, a.face[k])
        for (const k of BODY_MORPHS) set(k, a.body[k])
      }
    })
  }, [model, appearance])

  const styleModule = (obj: Object3D, kind: 'hair' | 'item', itemId?: string) => {
    obj.traverse((o) => {
      if (!isMesh(o)) return
      o.frustumCulled = false
      const mat = ownMaterial(o)
      if (!mat) return
      if (kind === 'hair') {
        mat.map = hairTexture(appearance.hair)
        mat.color.set('#ffffff')
        mat.roughness = 0.78 - appearance.hair.dye.gloss * 0.45
      } else if (itemId) {
        const it = items[Object.keys(items).find((k) => items[k as keyof typeof items]?.id === itemId) as keyof typeof items]
        if (!it) return
        const tex = patternTexture(it.pattern, it.colors[0], it.colors[1])
        if (/^Fabric/i.test(mat.name) || !mat.map) {
          mat.map = tex
          mat.color.set(tex ? '#ffffff' : it.colors[0])
        }
      }
      mat.needsUpdate = true
    })
  }

  const sockets = useMemo(() => findSockets(model), [model])
  // Each piercing renders at its socket(s); centred sites fall back to the _C socket.
  const jewellery = appearance.piercings.flatMap((p) => {
    const wanted = p.side === 'both' || p.site === 'snake-bites' ? ['L', 'R'] : p.side === 'right' ? ['R'] : ['L']
    const found = new Set<Object3D>()
    for (const sfx of wanted) {
      const socket = sockets.get(`Socket_${p.site}_${sfx}`) ?? sockets.get(`Socket_${p.site}_C`)
      if (socket) found.add(socket)
    }
    const ear = /lobe|helix|tragus|conch|daith|rook|industrial|flat|orbital/.test(p.site)
    return [...found].map((socket) => <Fragment key={`${p.id}-${socket.name}`}>{createPortal(<Jewellery p={p} plane={ear ? 'ear' : 'face'} />, socket)}</Fragment>)
  })

  return (
    <group ref={root} scale={appearance.body.height}>
      <primitive object={model} />
      {jewellery}
      {moduleUrls.map((m) => (
        <ModuleLoader key={m.key} url={m.url} base={model} onReady={(o) => styleModule(o, m.kind, m.itemId)} />
      ))}
    </group>
  )
}
