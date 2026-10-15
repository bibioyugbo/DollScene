/**
 * Dev-only scene lab (http://localhost:5174/scene-lab.html). Not part of the production build.
 *   ?scene=<id>&time=&weather=&cam=front|wide|thumb|spot<N>&animate=0|1&nochar=1&stats=1&ui=0
 *   ?cycle=1 mounts every scene in turn and logs GPU memory (leak check).
 * window.__dsShotReady turns true two frames after the scene (and stand-in character) rendered.
 */
import { useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MeshStandardMaterial, Vector3, type Mesh, type PerspectiveCamera } from 'three'
import { SkeletonUtils } from 'three-stdlib'
import { relaxPose } from '../character/pose'
import { mutate } from './kit/core'
import { SCENES, SCENE_BY_ID, SceneEnvironment, type SceneId, type TimeOfDay, type Weather } from './index'

declare global {
  interface Window {
    __dsShotReady?: boolean
  }
}

const q = new URLSearchParams(location.search)

function Mannequin({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  const { scene } = useGLTF('/models/studio/body.glb', false, true)
  const model = useMemo(() => {
    const m = SkeletonUtils.clone(scene)
    relaxPose(m)
    const mat = new MeshStandardMaterial({ color: '#d8c3b4', roughness: 0.55, metalness: 0 })
    m.traverse((o) => {
      const mesh = o as Mesh
      if (!mesh.isMesh) return
      mesh.frustumCulled = false
      const name = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)?.name ?? ''
      // keep only the body surface (no brows/lashes cards)
      if (/brow|lash/i.test(mesh.name)) mesh.visible = false
      mesh.material = /eye/i.test(name) ? new MeshStandardMaterial({ color: '#f2efe9', roughness: 0.2 }) : mat
    })
    return m
  }, [scene])
  return <primitive object={model} position={position} rotation-y={rotationY} />
}

function CameraPreset({ id, cam }: { id: SceneId; cam: string }) {
  const cameraObj = useThree((s) => s.camera) as PerspectiveCamera
  useLayoutEffect(() => mutate(cameraObj, (camera) => {
    const def = SCENE_BY_ID[id]
    const m = /^spot(\d)$/.exec(cam)
    if (m) {
      const s = def.photoSpots[Number(m[1])] ?? def.photoSpots[0]
      const [x, y, z] = s.position
      const d = 4.6
      camera.fov = 30
      camera.position.set(x + Math.sin(s.rotationY) * d, y + 1.3, z + Math.cos(s.rotationY) * d)
      camera.lookAt(new Vector3(x, y + 0.92, z))
    } else if (cam === 'wide') {
      camera.fov = 42
      camera.position.set(0, 2.1, 8.2)
      camera.lookAt(0, 1.5, 0)
    } else if (cam === 'thumb') {
      camera.fov = 42
      camera.position.set(0.55, 1.3, 6.3)
      camera.lookAt(0, 1.55, -1)
    } else if (cam === 'face') {
      camera.fov = 30
      camera.position.set(0, 1.56, 1.25)
      camera.lookAt(0, 1.53, 0)
    } else {
      camera.fov = 30
      camera.position.set(0, 1.3, 4.6)
      camera.lookAt(0, 0.92, 0)
    }
    camera.near = 0.05
    camera.far = 80
    camera.updateProjectionMatrix()
  }), [cameraObj, cam, id])
  return null
}

function Stats({ label }: { label: string }) {
  const gl = useThree((s) => s.gl)
  let n = 0
  useFrame(() => {
    n++
    if (n === 20) {
      const r = gl.info.render
      const m = gl.info.memory
      console.warn(`[stats] ${label} calls=${r.calls} tris=${r.triangles} points=${r.points} lines=${r.lines} geometries=${m.geometries} textures=${m.textures} programs=${gl.info.programs?.length}`)
    }
  })
  return null
}

function ShotReady({ ready }: { ready: boolean }) {
  useEffect(() => {
    if (!ready) return
    requestAnimationFrame(() => requestAnimationFrame(() => (window.__dsShotReady = true)))
  }, [ready])
  return null
}

function Cycler({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl)
  const [i, setI] = useState(0)
  const ids = useMemo(() => [...SCENES.map((s) => s.id), ...SCENES.map((s) => s.id), SCENES[0].id], [])
  useEffect(() => {
    const t = setTimeout(() => {
      const m = gl.info.memory
      console.warn(`[cycle] ${i} ${ids[i]} geometries=${m.geometries} textures=${m.textures}`)
      if (i + 1 < ids.length) setI(i + 1)
      else onDone()
    }, 700)
    return () => clearTimeout(t)
  }, [i, gl, ids, onDone])
  return <SceneEnvironment id={ids[i]} time={SCENE_BY_ID[ids[i]].defaultTime} weather={SCENE_BY_ID[ids[i]].defaultWeather} animate />
}

export default function Lab() {
  const [id, setId] = useState<SceneId>((q.get('scene') as SceneId) ?? 'prom2016')
  const def = SCENE_BY_ID[id] ?? SCENES[0]
  const [time, setTime] = useState<TimeOfDay>((q.get('time') as TimeOfDay) ?? def.defaultTime)
  const [weather, setWeather] = useState<Weather>((q.get('weather') as Weather) ?? def.defaultWeather)
  const [cam, setCam] = useState(q.get('cam') ?? 'front')
  const [sceneReady, setSceneReady] = useState(false)
  const [cycleDone, setCycleDone] = useState(false)
  const animate = q.get('animate') !== '0'
  const showUi = q.get('ui') !== '0'
  const spotIdx = /^spot(\d)$/.exec(cam)
  const spot = def.photoSpots[spotIdx ? Number(spotIdx[1]) : 0] ?? def.photoSpots[0]
  const t = def.times.includes(time) ? time : def.defaultTime
  const w = def.weathers.includes(weather) ? weather : def.defaultWeather

  return (
    <>
      <Canvas dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }} camera={{ fov: 30, near: 0.05, far: 80, position: [0, 1.3, 4.6] }}>
        {q.get('cycle') ? (
          <Suspense fallback={null}>
            <Cycler onDone={() => setCycleDone(true)} />
            <ShotReady ready={cycleDone} />
          </Suspense>
        ) : (
          <Suspense fallback={null}>
            <SceneEnvironment key={id} id={id} time={t} weather={w} animate={animate} spot={spot.id} onReady={() => setSceneReady(true)} />
            {!q.get('nochar') && <Mannequin position={spot.position} rotationY={spot.rotationY} />}
            <CameraPreset id={id} cam={cam} />
            {q.get('stats') && sceneReady && <Stats label={`${id}/${t}/${w}`} />}
            <ShotReady ready={sceneReady} />
          </Suspense>
        )}
      </Canvas>
      {showUi && (
        <div style={{ position: 'fixed', left: 8, top: 8, display: 'flex', gap: 6, flexWrap: 'wrap', background: 'rgba(0,0,0,.45)', padding: 6, borderRadius: 8 }}>
          <select value={id} onChange={(e) => (setSceneReady(false), setId(e.target.value as SceneId))}>
            {SCENES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select value={t} onChange={(e) => setTime(e.target.value as TimeOfDay)}>
            {def.times.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select value={w} onChange={(e) => setWeather(e.target.value as Weather)}>
            {def.weathers.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select value={cam} onChange={(e) => setCam(e.target.value)}>
            {['front', 'wide', 'thumb', 'face', ...def.photoSpots.map((_, i) => `spot${i}`)].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </div>
      )}
    </>
  )
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')!).render(<Lab />)
