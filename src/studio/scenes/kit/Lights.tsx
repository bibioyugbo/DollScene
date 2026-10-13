import { Environment, Lightformer } from '@react-three/drei'
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { AdditiveBlending, type DirectionalLight, type HemisphereLight, type Object3D } from 'three'
import type { V3 } from '../types'
import { radialTexture, useBuilt } from './core'

export interface LightSpec {
  color: string
  intensity: number
  /** Offset from the subject (photo spot). */
  offset?: V3
}

export interface SceneLightsProps {
  /** Where the character stands; key and rim aim at its head. */
  spot: V3
  /** Ambient fill: sky colour, ground colour, intensity. */
  hemi: [string, string, number]
  keyLight: LightSpec
  rim: LightSpec
  /** Soft image-based fill for the character's PBR materials (skin, hair, fabric sheen). */
  env: {
    intensity: number
    /** Big soft box in front of the face. */
    front: string
    /** Behind / above, gives hair and shoulders a sheen. */
    back: string
    /** Overall tint of the surroundings (what the darker parts of reflections show). */
    ambient: string
    /** Optional extra coloured cards (scene neon, sunset, screens) at world positions. */
    extra?: { color: string; intensity: number; position: V3; scale: [number, number] }[]
  }
  keyRef?: RefObject<DirectionalLight | null>
  rimRef?: RefObject<DirectionalLight | null>
  hemiRef?: RefObject<HemisphereLight | null>
  /** Remount key for the environment map (it renders once); change it when env colours change. */
  envKey?: string
  children?: ReactNode
}

/**
 * The three real lights every scene gets (hemisphere fill, soft frontal key, back rim) and a
 * one-shot environment map. Scenes keep their own props on Lambert/basic materials, so the env
 * map mostly flatters the character's skin and hair.
 */
export function SceneLights({ spot, hemi, keyLight, rim, env, keyRef, rimRef, hemiRef, envKey }: SceneLightsProps) {
  const target = useRef<Object3D>(null)
  const keyL = useRef<DirectionalLight>(null)
  const rimL = useRef<DirectionalLight>(null)
  useLayoutEffect(() => {
    if (!target.current) return
    if (keyL.current) keyL.current.target = target.current
    if (rimL.current) rimL.current.target = target.current
    if (keyRef) keyRef.current = keyL.current
    if (rimRef) rimRef.current = rimL.current
  })
  const ko = keyLight.offset ?? [-1.4, 2.2, 3.2]
  const ro = rim.offset ?? [1.6, 2.6, -2.6]
  const head: V3 = [spot[0], spot[1] + 1.45, spot[2]]
  return (
    <>
      <object3D ref={target} position={head} />
      <hemisphereLight ref={hemiRef} args={[hemi[0], hemi[1], hemi[2]]} />
      <directionalLight ref={keyL} color={keyLight.color} intensity={keyLight.intensity} position={[head[0] + ko[0], head[1] + ko[1], head[2] + ko[2]]} />
      <directionalLight ref={rimL} color={rim.color} intensity={rim.intensity} position={[head[0] + ro[0], head[1] + ro[1], head[2] + ro[2]]} />
      <Environment key={envKey} resolution={64} frames={1} environmentIntensity={env.intensity}>
        <color attach="background" args={[env.ambient]} />
        <Lightformer form="rect" intensity={2.6} position={[-1.8, 2.2, 3]} scale={[2.6, 3, 1]} color={env.front} />
        <Lightformer form="rect" intensity={1.1} position={[2.2, 1.4, 2.6]} scale={[2, 2.6, 1]} color={env.front} />
        <Lightformer form="rect" intensity={1.2} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[4, 4, 1]} color={env.ambient} />
        <Lightformer form="rect" intensity={1.6} position={[1.5, 2.4, -3]} scale={[3, 2, 1]} color={env.back} />
        <Lightformer form="rect" intensity={1.0} position={[-2, 1.6, -3]} scale={[2, 2, 1]} color={env.back} />
        {env.extra?.map((e, i) => (
          <Lightformer key={i} form="rect" intensity={e.intensity} position={e.position} scale={[e.scale[0], e.scale[1], 1]} color={e.color} />
        ))}
      </Environment>
    </>
  )
}

/** Soft contact shadow decal under the character (no real-time shadows). */
export function BlobShadow({ position, opacity = 0.55, size = 1.1 }: { position: V3; opacity?: number; size?: number }) {
  const tex = useBuilt((track) => track(radialTexture(128, 0.8)), [])
  return (
    <group position={position}>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={2}>
        <planeGeometry args={[size, size * 0.8]} />
        <meshBasicMaterial map={tex} color="#000" transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.007} renderOrder={2}>
        <planeGeometry args={[size * 0.5, size * 0.38]} />
        <meshBasicMaterial map={tex} color="#000" transparent opacity={opacity * 0.8} depthWrite={false} polygonOffset polygonOffsetFactor={-3} />
      </mesh>
    </group>
  )
}

/** Additive pool of light on the floor (a "spot" on the stage), cheap and flattering. */
export function LightPool({ position, color, size = 3, opacity = 0.35 }: { position: V3; color: string; size?: number; opacity?: number }) {
  const tex = useBuilt((track) => track(radialTexture(128, 0.7)), [])
  return (
    <mesh position={[position[0], position[1] + 0.004, position[2]]} rotation-x={-Math.PI / 2} renderOrder={1}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  )
}
