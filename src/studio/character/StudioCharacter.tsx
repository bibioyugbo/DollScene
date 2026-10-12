import { useGLTF, useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Color,
  DoubleSide,
  NoColorSpace,
  SRGBColorSpace,
  TextureLoader,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
} from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { ALL_MORPHS, type StudioLook } from '../../shared/studio/look'
import { attachModule } from '../../three/doll/attachModule'
import { url, type CharacterCatalog } from './catalog'
import { idleRig, idleTick, relaxPose } from './pose'
import { applyLookToSkin, createSkinMaterial, type SkinUniforms } from './skinMaterial'

/**
 * The studio's 3D character: the CC0 MakeHuman-derived base (public/models/studio/body.glb)
 * plus hair, outfit and shoe modules bound to its skeleton by bone name. Every mesh's
 * "<Morph>_Neg" / "<Morph>_Pos" targets follow the look's sliders, so clothes and hair
 * reshape with the body.
 */

const isMesh = (o: Object3D): o is Mesh => (o as Mesh).isMesh === true

function applyMorphs(mesh: Mesh, look: StudioLook) {
  const dict = mesh.morphTargetDictionary
  const inf = mesh.morphTargetInfluences
  if (!dict || !inf) return
  for (const m of ALL_MORPHS) {
    const v = look.morphs[m]
    const neg = dict[`${m}_Neg`]
    const pos = dict[`${m}_Pos`]
    if (neg !== undefined) inf[neg] = Math.max(0, (0.5 - v) * 2)
    if (pos !== undefined) inf[pos] = Math.max(0, (v - 0.5) * 2)
  }
}

const maskTex = (t: Texture) => {
  t.flipY = false
  t.colorSpace = NoColorSpace
  t.needsUpdate = true
  return t
}

const eyeTextures = new Map<string, Promise<Texture>>()
function eyeTexture(id: string) {
  let p = eyeTextures.get(id)
  if (!p) {
    p = new TextureLoader().loadAsync(url.eye(id)).then((t) => {
      t.flipY = false
      t.colorSpace = SRGBColorSpace
      return t
    })
    eyeTextures.set(id, p)
  }
  return p
}

const HAIR_K = 1 / 0.62

/** Only the chosen brow and lash meshes are drawn; brows take the brow colour. */
function showVariants(brows: Map<string, Mesh>, lashes: Map<string, Mesh>, look: StudioLook) {
  for (const [id, mesh] of brows) {
    mesh.visible = id === look.brows.shape
    ;(mesh.material as MeshStandardMaterial).color.set(look.brows.color).multiplyScalar(HAIR_K)
  }
  for (const [id, mesh] of lashes) mesh.visible = id === look.lashes.style
}

/* ------------------------------------------------------------------ modules */

type Registry = { add: (meshes: Mesh[]) => void; remove: (meshes: Mesh[]) => void }

function useModule(src: string, base: Object3D, registry: Registry, style: (meshes: Mesh[]) => void, onAttach?: () => () => void) {
  const gltf = useGLTF(src, false, true)
  useLayoutEffect(() => {
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
    style(meshes)
    registry.add(meshes)
    const detach = onAttach?.()
    return () => {
      detach?.()
      registry.remove(meshes)
      attached.parent?.remove(attached)
    }
    // style reads the latest look through a ref; re-attaching on every look change would be wasteful
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, base, registry])
}

function HairModule({ id, base, registry, look }: { id: string; base: Object3D; registry: Registry; look: StudioLook }) {
  const meshes = useRef<Mesh[]>([])
  useModule(url.hair(id), base, registry, (m) => {
    meshes.current = m
    for (const mesh of m) {
      const mat = mesh.material as MeshStandardMaterial
      mat.alphaTest = 0.45
      mat.transparent = false
      mat.side = DoubleSide
      // Cards: keep the sheen soft or the strands read as plastic bands.
      mat.roughness = 0.82
      mat.metalness = 0
      mat.envMapIntensity = 0.45
      mat.needsUpdate = true
    }
  })
  useLayoutEffect(() => {
    for (const mesh of meshes.current) (mesh.material as MeshStandardMaterial).color.set(look.hair.color).multiplyScalar(HAIR_K)
  }, [look.hair.color, id])
  return null
}

function OutfitModule({ src, mask, base, registry, onMask, dye }: { src: string; mask: string | null; base: Object3D; registry: Registry; onMask: (t: Texture | null) => void; dye?: StudioLook['outfit'] }) {
  const hide = useTexture(mask ?? url.mask('body'))
  const uniforms = useRef({ uDye: { value: new Color() }, uDyeAmount: { value: 0 } })
  useModule(
    src,
    base,
    registry,
    (meshes) => {
      for (const mesh of meshes) {
        const mat = mesh.material as MeshStandardMaterial
        mat.alphaTest = 0.4
        mat.transparent = false
        mat.side = DoubleSide
        mat.roughness = 0.75
        if (dye) {
          mat.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, uniforms.current)
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', '#include <common>\nuniform vec3 uDye;\nuniform float uDyeAmount;')
              .replace(
                '#include <map_fragment>',
                '#include <map_fragment>\nfloat dsL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\ndiffuseColor.rgb = mix(diffuseColor.rgb, uDye * (0.25 + dsL * 1.6), uDyeAmount);',
              )
          }
          mat.customProgramCacheKey = () => 'dollscene-fabric-dye'
        }
        mat.needsUpdate = true
      }
    },
    () => {
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

/* ------------------------------------------------------------------ character */

export function StudioCharacter({ look, catalog, animate }: { look: StudioLook; catalog: CharacterCatalog; animate: boolean }) {
  const { scene } = useGLTF(url.body, false, true)
  const [faceA, faceB, faceC, bodyMask] = useTexture([url.mask('face_a'), url.mask('face_b'), url.mask('face_c'), url.mask('body')])

  const setup = useMemo(() => {
    const model = SkeletonUtils.clone(scene)
    relaxPose(model)
    let skin: SkinUniforms | null = null
    const brows = new Map<string, Mesh>()
    const lashes = new Map<string, Mesh>()
    let eyes: Mesh | null = null
    const base: Mesh[] = []
    model.traverse((o) => {
      if (!isMesh(o)) return
      o.frustumCulled = false
      const src = o.material as MeshStandardMaterial
      base.push(o)
      if (src.name === 'Skin') {
        const s = createSkinMaterial(src, { faceA: maskTex(faceA), faceB: maskTex(faceB), faceC: maskTex(faceC), body: maskTex(bodyMask) }, catalog.faceRect)
        o.material = s.material
        skin = s.uniforms
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
    return { model, skin: skin as SkinUniforms | null, brows, lashes, eyes: eyes as Mesh | null, base, idle: idleRig(model) }
  }, [scene, faceA, faceB, faceC, bodyMask, catalog.faceRect])

  // Every mesh with morph targets: the body set plus whatever modules are attached.
  const lookRef = useRef(look)
  lookRef.current = look
  const morphMeshes = useMemo(() => new Set<Mesh>(setup.base), [setup])
  const registry = useMemo<Registry>(
    () => ({
      add: (meshes) =>
        meshes.forEach((m) => {
          morphMeshes.add(m)
          applyMorphs(m, lookRef.current)
        }),
      remove: (meshes) => meshes.forEach((m) => morphMeshes.delete(m)),
    }),
    [morphMeshes],
  )

  useLayoutEffect(() => {
    for (const m of morphMeshes) applyMorphs(m, look)
    if (setup.skin) applyLookToSkin(setup.skin, look)
    showVariants(setup.brows, setup.lashes, look)
  }, [look, setup, morphMeshes])

  useEffect(() => {
    let live = true
    const eyes = setup.eyes
    if (!eyes) return
    eyeTexture(look.eyes.iris).then((t) => {
      if (!live) return
      const mat = eyes.material as MeshStandardMaterial
      mat.map = t
      mat.needsUpdate = true
    })
    return () => {
      live = false
    }
  }, [look.eyes.iris, setup])

  // Hide skin under clothes and shoes (masks from the build).
  const setHide = (slot: 0 | 1) => (t: Texture | null) => {
    if (!setup.skin) return
    if (slot === 0) setup.skin.uHide0.value = t
    else setup.skin.uHide1.value = t
    setup.skin.uHideOn.value.setComponent(slot, t ? 1 : 0)
  }

  useFrame(({ clock }) => idleTick(setup.idle, clock.elapsedTime, animate ? 1 : 0))

  // Keep the old module on screen until the new one has loaded (no flash of bare skin).
  const hairId = useDeferredValue(look.hair.style)
  const outfitId = useDeferredValue(look.outfit.id)
  const shoeId = useDeferredValue(look.shoes.id)
  const outfit = catalog.outfits.find((o) => o.id === outfitId)
  const shoes = catalog.shoes.find((s) => s.id === shoeId)

  return (
    <group scale={look.height}>
      <primitive object={setup.model} />
      {hairId !== 'none' && <HairModule key={hairId} id={hairId} base={setup.model} registry={registry} look={look} />}
      {outfit && (
        <OutfitModule key={outfit.id} src={url.outfit(outfit.id)} mask={outfit.hideMask ? url.mask(`hide_${outfit.id}`) : null} base={setup.model} registry={registry} onMask={setHide(0)} dye={look.outfit} />
      )}
      {shoes && <OutfitModule key={shoes.id} src={url.shoes(shoes.id)} mask={shoes.hideMask ? url.mask(`hide_${shoes.id}`) : null} base={setup.model} registry={registry} onMask={setHide(1)} />}
    </group>
  )
}

useGLTF.preload(url.body, false, true)
