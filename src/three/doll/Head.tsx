import { Decal } from '@react-three/drei'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'
import type { Appearance, MakeupState, Tattoo } from '../../shared/types'
import { tattooTexture } from '../textures'
import { EAR_CENTER, HEAD_R, headSocket, isEarSite, sidesFor } from './dims'
import { Hair } from './Hair'
import { Jewellery } from './Jewellery'
import { SkinMat } from './materials'

const R = HEAD_R

export function shade(hex: string, amount: number): string {
  const c = new Color(hex)
  if (amount < 0) c.lerp(new Color('#000000'), -amount)
  else c.lerp(new Color('#ffffff'), amount)
  return `#${c.getHexString()}`
}

function onFace(x: number, y: number, lift = 0.001): [number, number, number] {
  const z = Math.sqrt(Math.max(0, (R + lift) ** 2 - x * x - (y / 1.05) ** 2))
  return [x, y, z]
}

/** Deterministic dot positions for freckles and dot art. */
function Dots({ points, size, color, opacity = 1, emissive }: { points: [number, number, number][]; size: number; color: string; opacity?: number; emissive?: boolean }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    points.forEach((p, i) => {
      o.position.set(...p)
      o.scale.set(1, 1, 0.35)
      o.lookAt(p[0] * 2, p[1] * 2, p[2] * 2)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.count = points.length
    m.instanceMatrix.needsUpdate = true
  }, [points])
  if (!points.length) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} frustumCulled={false}>
      <sphereGeometry args={[size, 6, 4]} />
      <meshStandardMaterial color={color} transparent={opacity < 1} opacity={opacity} emissive={emissive ? color : '#000'} emissiveIntensity={emissive ? 0.8 : 0} roughness={0.6} />
    </instancedMesh>
  )
}

function scatter(n: number, seed: number, area: (r: () => number) => [number, number]): [number, number, number][] {
  let s = seed
  const r = () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
  return Array.from({ length: n }, () => {
    const [x, y] = area(r)
    return onFace(x, y, 0.0015)
  })
}

function FaceTattoo({ t, side }: { t: Tattoo; side: number }) {
  const s = 0.03 + t.size * 0.06
  const position = useMemo<[number, number, number]>(() => [side * 0.085, -0.02, 0.11], [side])
  const rotation = useMemo<[number, number, number]>(() => [0, side * 0.65, (t.rotation * Math.PI) / 180], [side, t.rotation])
  const scale = useMemo<[number, number, number]>(() => [s * side, s, 0.06], [s, side])
  return (
    <Decal position={position} rotation={rotation} scale={scale}>
      <meshBasicMaterial map={tattooTexture(t.design, t.color)} transparent opacity={t.opacity * (t.temporary ? 0.75 : 0.92)} polygonOffset polygonOffsetFactor={-4 - t.layer} depthWrite={false} />
    </Decal>
  )
}

function FaceTattoos({ tattoos }: { tattoos: Tattoo[] }) {
  return <>{tattoos.flatMap((t) => (t.mirror ? [1, -1] : [1]).map((side) => <FaceTattoo key={`${t.id}${side}`} t={t} side={side} />))}</>
}

const BROW: Record<MakeupState['brows'], { h: number; arch: number; len: number; gap?: boolean; flat?: boolean }> = {
  skinny: { h: 0.0025, arch: 0.32, len: 2.4 },
  thin: { h: 0.004, arch: 0.22, len: 2.5 },
  natural: { h: 0.007, arch: 0.12, len: 2.6 },
  laminated: { h: 0.009, arch: 0.05, len: 2.7 },
  bold: { h: 0.011, arch: 0.12, len: 2.7 },
  thick: { h: 0.013, arch: 0.08, len: 2.8 },
  '2016': { h: 0.012, arch: 0.28, len: 2.8, flat: true },
  shaped: { h: 0.008, arch: 0.3, len: 2.6 },
  slit: { h: 0.007, arch: 0.12, len: 2.6, gap: true },
}

/** Two-part brow so arches read: an inner segment and an angled tail. */
function Brow({ side, style, lift, eyeR, color }: { side: number; style: MakeupState['brows']; lift: number; eyeR: number; color: string }) {
  const b = BROW[style]
  const w = eyeR * b.len
  const y = 0.03 + lift * 0.016
  const mat = <meshStandardMaterial color={color} roughness={0.9} />
  return (
    <group position={[side * 0.004, y, 0.004]} rotation={[0.3, 0, 0]}>
      {/* inner body (towards the nose) */}
      <mesh position={[-side * w * 0.22, 0, 0]} rotation={[0, 0, side * (b.flat ? 0 : -0.05)]}>
        <boxGeometry args={[w * 0.55, b.h * (b.flat ? 1.15 : 1), 0.006]} />
        {mat}
      </mesh>
      {/* tail, angled down by the arch */}
      {b.gap ? (
        <mesh position={[side * w * 0.36, -b.arch * 0.01, 0]} rotation={[0, 0, side * -b.arch]}>
          <boxGeometry args={[w * 0.22, b.h * 0.85, 0.006]} />
          {mat}
        </mesh>
      ) : (
        <mesh position={[side * w * 0.25, -b.arch * 0.008, 0]} rotation={[0, 0, side * -b.arch]}>
          <boxGeometry args={[w * 0.5, b.h * 0.85, 0.006]} />
          {mat}
        </mesh>
      )}
    </group>
  )
}

/** Beards, moustaches, stubble and sideburns, built on the lower face. */
function FacialHairMesh({ a }: { a: Appearance }) {
  const fh = a.facialHair
  if (!fh || fh.style === 'none') return null
  const c = fh.color
  const d = fh.density
  const shell = (opacity: number, scale = 1, theta: [number, number] = [Math.PI * 0.5, Math.PI * 0.42]) => (
    <mesh position={[0, -0.06, 0.012]} scale={[(0.98 + a.face.jaw * 0.22) * scale, 0.86 * scale, 0.97 * scale]}>
      <sphereGeometry args={[0.103, 28, 16, Math.PI / 2 - 1.25, 2.5, theta[0], theta[1]]} />
      <meshStandardMaterial color={c} roughness={1} transparent opacity={opacity} depthWrite={opacity > 0.8} />
    </mesh>
  )
  const moustache = (
    <mesh position={[0, -0.056, 0.142]} rotation={[0, 0, Math.PI / 2]}>
      <capsuleGeometry args={[0.006 + d * 0.003, 0.03, 4, 8]} />
      <meshStandardMaterial color={c} roughness={1} />
    </mesh>
  )
  switch (fh.style) {
    case 'stubble':
      return shell(0.18 + d * 0.25, 1.01)
    case 'moustache':
      return moustache
    case 'goatee':
      return (
        <group>
          {moustache}
          <mesh position={[0, -0.112, 0.085]} scale={[0.8, 1.1, 0.7]}>
            <sphereGeometry args={[0.03 + d * 0.006, 14, 10]} />
            <meshStandardMaterial color={c} roughness={1} />
          </mesh>
        </group>
      )
    case 'short-beard':
      return (
        <group>
          {shell(0.55 + d * 0.4, 1.04)}
          {moustache}
        </group>
      )
    case 'full-beard':
      return (
        <group>
          {shell(0.95, 1.1, [Math.PI * 0.46, Math.PI * 0.5])}
          {moustache}
        </group>
      )
    case 'sideburns':
      return (
        <group>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * 0.138, -0.02, 0.02]}>
              <capsuleGeometry args={[0.008 + d * 0.004, 0.05, 4, 8]} />
              <meshStandardMaterial color={c} roughness={1} />
            </mesh>
          ))}
        </group>
      )
    case 'chin-strap':
      return (
        <mesh position={[0, -0.05, 0.01]} rotation={[Math.PI / 2 + 0.35, 0, 0]} scale={[0.98 + a.face.jaw * 0.22, 1, 1]}>
          <torusGeometry args={[0.105, 0.005 + d * 0.004, 6, 32, Math.PI]} />
          <meshStandardMaterial color={c} roughness={1} />
        </mesh>
      )
  }
  return null
}

/** Head in head space: face shape, features, makeup, marks, ears, hair and head piercings. */
export function Head({ a, hideHairTop = false }: { a: Appearance; hideHairTop?: boolean }) {
  const f = a.face
  const m = a.makeup
  const masc = a.base === 'masculine'
  const tone = a.skin.faceTone ?? a.skin.tone
  const skin = <SkinMat color={tone} undertone={a.skin.undertone} glow={a.skin.glow} />
  const lipNatural = shade(tone, -0.28)
  const lipColor = m.lipstick ?? lipNatural
  const browColor = shade(a.hair.color === '#FFFFFF' ? '#3B2219' : a.hair.color, -0.15)
  const eyeR = 0.017 + f.eyeSize * 0.008
  const eyeX = 0.045 + f.eyeSpacing * 0.016
  const eyeSquash = 1 - f.eyeShape * 0.32
  const marks = a.skin.marks
  const faceTattoos = a.tattoos.filter((t) => t.region === 'face')

  const freckles = useMemo(
    () =>
      marks.freckles
        ? scatter(Math.round(12 + marks.freckles * 46), 3, (r) => [(r() - 0.5) * 0.16, -0.035 + (r() - 0.5) * 0.04])
        : [],
    [marks.freckles],
  )
  const beautyMarks = useMemo(
    () => (marks['beauty-marks'] ? [onFace(0.035, -0.06, 0.0015), onFace(-0.07, -0.02, 0.0015), onFace(0.06, 0.02, 0.0015)].slice(0, 1 + Math.round(marks['beauty-marks'] * 2)) : []),
    [marks],
  )
  const tribalDots = useMemo(
    () => (m.look === 'tribal-dots' ? [...[-0.08, -0.065, -0.05].map((x) => onFace(x, -0.015, 0.002)), ...[0.08, 0.065, 0.05].map((x) => onFace(x, -0.015, 0.002)), ...[-0.02, 0, 0.02].map((x) => onFace(x, 0.085, 0.002))] : []),
    [m.look],
  )
  const glitter = useMemo(() => (m.look === 'glitter' ? scatter(40, 9, (r) => [(r() - 0.5) * 0.2, 0.0 + r() * 0.045]) : []), [m.look])
  const freckleArt = useMemo(() => (m.look === 'freckle-art' ? scatter(26, 5, (r) => [(r() - 0.5) * 0.17, -0.03 + (r() - 0.5) * 0.04]) : []), [m.look])

  return (
    <group>
      {/* skull and jaw */}
      <mesh scale={[1 + (f.jaw - 0.5) * 0.08, 1.05 + (f.forehead - 0.5) * 0.06, 1]}>
        <sphereGeometry args={[R, 40, 28]} />
        {skin}
        <FaceTattoos tattoos={faceTattoos} />
      </mesh>
      <mesh position={[0, -0.06, 0.01]} scale={[0.92 + f.jaw * 0.22 + (masc ? 0.06 : 0), 0.8, 0.92]}>
        <sphereGeometry args={[0.1, 24, 16]} />
        {skin}
      </mesh>
      <mesh position={[0, -0.112, 0.07]} scale={[1, 0.9, 0.9 + f.chin * 0.3]}>
        <sphereGeometry args={[0.03 + f.chin * 0.012, 16, 12]} />
        {skin}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`cb${s}`} position={[s * 0.074, -0.012, 0.095]}>
          <sphereGeometry args={[0.034 + f.cheekbones * 0.014, 16, 12]} />
          {skin}
        </mesh>
      ))}

      {/* ears */}
      {[-1, 1].map((s) => (
        <mesh key={`ear${s}`} position={[s * EAR_CENTER[0], EAR_CENTER[1], EAR_CENTER[2]]} scale={[0.018, 0.048, 0.032]}>
          <sphereGeometry args={[1, 16, 12]} />
          {skin}
        </mesh>
      ))}

      {/* nose */}
      <mesh position={[0, -0.005, 0.138]} rotation={[0.25, 0, 0]}>
        <capsuleGeometry args={[0.009 + f.nose * 0.004, 0.035, 6, 10]} />
        {skin}
      </mesh>
      <mesh position={[0, -0.03, 0.146]} scale={[1 + (f.nose - 0.5) * 0.6, 0.85, 0.9]}>
        <sphereGeometry args={[0.016, 16, 12]} />
        {skin}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={`nos${s}`} position={[s * (0.014 + f.nose * 0.006), -0.034, 0.138]}>
          <sphereGeometry args={[0.011, 12, 10]} />
          {skin}
        </mesh>
      ))}

      {/* eyes, lids, liner, lashes, shadow, brows */}
      {[-1, 1].map((s) => {
        const asym = s === 1 ? f.asymmetry * 0.006 : 0
        const x = s * eyeX
        const y = 0.006 + asym
        const z = Math.sqrt(R * R - x * x - y * y) - eyeR * 0.45
        return (
          <group key={`eye${s}`} position={[x, y, z]} rotation={[0, s * 0.12, s * -0.08 * f.eyeShape]}>
            <mesh scale={[1.2, eyeSquash, 0.7]}>
              <sphereGeometry args={[eyeR, 20, 14]} />
              <meshPhysicalMaterial color="#FAF7F5" roughness={0.15} clearcoat={1} />
            </mesh>
            <mesh position={[0, 0, eyeR * 0.55]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[eyeR * 0.62, 16, 12]} />
              <meshPhysicalMaterial color={f.eyeColor} roughness={0.2} clearcoat={1} />
            </mesh>
            <mesh position={[0, 0, eyeR * 0.72]} scale={[1, 1, 0.4]}>
              <sphereGeometry args={[eyeR * 0.3, 12, 10]} />
              <meshStandardMaterial color="#0B0608" roughness={0.1} />
            </mesh>
            {/* upper lid */}
            <mesh position={[0, eyeR * 0.55, 0.002]} scale={[1.28, 0.42 + f.eyeShape * 0.2, 0.8]}>
              <sphereGeometry args={[eyeR * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.36]} />
              {skin}
            </mesh>
            {m.eyeshadow && (
              <mesh position={[0, eyeR * 0.75, 0.002]} scale={[1.6, 0.6, 0.6]}>
                <sphereGeometry args={[eyeR * 1.05, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
                <meshStandardMaterial
                  color={m.eyeshadow}
                  transparent
                  opacity={0.75}
                  metalness={m.look === 'chrome' ? 1 : 0.1}
                  roughness={m.look === 'chrome' ? 0.15 : 0.6}
                />
              </mesh>
            )}
            {m.eyeliner !== 'none' && (
              <group>
                <mesh position={[0, eyeR * 0.62 * eyeSquash, eyeR * 0.55]} rotation={[0.5, 0, 0]}>
                  <boxGeometry args={[eyeR * 2.3, 0.0018 * (m.eyeliner === 'graphic' ? 2 : 1), 0.002]} />
                  <meshStandardMaterial color="#0B0608" />
                </mesh>
                {(m.eyeliner === 'wing' || m.eyeliner === 'graphic') && (
                  <mesh position={[s * eyeR * 1.35, eyeR * 0.8, eyeR * 0.2]} rotation={[0, 0, s * 0.55]}>
                    <boxGeometry args={[eyeR * (m.eyeliner === 'graphic' ? 1.5 : 0.9), 0.0022, 0.002]} />
                    <meshStandardMaterial color="#0B0608" />
                  </mesh>
                )}
              </group>
            )}
            {m.lashes !== 'none' && (
              <mesh position={[0, eyeR * 0.75 * eyeSquash, eyeR * 0.5]} rotation={[-0.9, 0, 0]}>
                <boxGeometry args={[eyeR * 2.2, { natural: 0.004, volume: 0.007, drama: 0.011 }[m.lashes], 0.0015]} />
                <meshStandardMaterial color="#0B0608" />
              </mesh>
            )}
            {/* brow */}
            <Brow side={s} style={m.brows} lift={f.brows} eyeR={eyeR} color={browColor} />
          </group>
        )
      })}

      <FacialHairMesh a={a} />

      {/* lips */}
      <group position={[0, -0.072, 0.128]}>
        {[0.005, -0.007].map((y, i) => (
          <mesh key={y} position={[0, y, i ? -0.002 : 0]} scale={[1.25, i ? 0.62 : 0.5, 0.42]}>
            <sphereGeometry args={[0.017 + f.lips * 0.01, 20, 12]} />
            <meshPhysicalMaterial color={lipColor} roughness={0.55 - m.gloss * 0.45} clearcoat={m.gloss} clearcoatRoughness={0.1} />
          </mesh>
        ))}
      </group>

      {m.lipLiner && (
        <mesh position={[0, -0.072, 0.131]} scale={[1.25, 0.6, 0.42]}>
          <torusGeometry args={[0.019 + f.lips * 0.01, 0.0018, 6, 32]} />
          <meshStandardMaterial color={m.lipLiner} roughness={0.6} />
        </mesh>
      )}

      {/* blush, highlight, contour */}
      {m.blush &&
        [-1, 1].map((s) => (
          <mesh key={`bl${s}`} position={onFace(s * 0.075, -0.035, 0.004)} scale={[1, 0.6, 0.2]}>
            <sphereGeometry args={[0.024, 16, 10]} />
            <meshStandardMaterial color={m.blush!} transparent opacity={m.blushAmount * 0.55} depthWrite={false} />
          </mesh>
        ))}
      {m.highlight > 0.05 &&
        [-1, 1].map((s) => (
          <mesh key={`hl${s}`} position={onFace(s * 0.07, -0.004, 0.006)} scale={[1, 0.45, 0.2]}>
            <sphereGeometry args={[0.018, 12, 8]} />
            <meshStandardMaterial color="#FFF4E0" transparent opacity={m.highlight * 0.35} emissive="#FFF4E0" emissiveIntensity={0.3} depthWrite={false} />
          </mesh>
        ))}
      {m.contour > 0.05 &&
        [-1, 1].map((s) => (
          <mesh key={`ct${s}`} position={onFace(s * 0.098, -0.048, 0.004)} rotation={[0, 0, s * 0.5]} scale={[1.4, 0.4, 0.2]}>
            <sphereGeometry args={[0.022, 12, 8]} />
            <meshStandardMaterial color={shade(tone, -0.4)} transparent opacity={m.contour * 0.35} depthWrite={false} />
          </mesh>
        ))}

      {/* marks */}
      <Dots points={freckles} size={0.0016} color={shade(tone, -0.35)} opacity={0.85} />
      <Dots points={beautyMarks} size={0.0028} color={shade(tone, -0.6)} />
      <Dots points={freckleArt} size={0.0022} color="#6B3E26" />
      <Dots points={tribalDots} size={0.0035} color="#FFFFFF" />
      <Dots points={glitter} size={0.0012} color="#FFF1C1" emissive />
      {m.look === 'face-gems' &&
        [-1, 1].map((s) =>
          [0, 1, 2].map((k) => (
            <mesh key={`gem${s}${k}`} position={onFace(s * (0.045 + k * 0.012), -0.022 - k * 0.004, 0.003)}>
              <octahedronGeometry args={[0.0035]} />
              <meshPhysicalMaterial color={['#7CF0CF', '#FF3D8B', '#FFC24D'][k]} roughness={0.05} clearcoat={1} />
            </mesh>
          )),
        )}
      {marks.vitiligo && (
        <group>
          {[
            [0.04, 0.03, 1],
            [-0.05, -0.06, 0.8],
            [0.02, -0.09, 0.6],
          ].map(([x, y, k], i) => (
            <mesh key={`vit${i}`} position={onFace(x, y, 0.002)} scale={[1, 0.8, 0.15]}>
              <sphereGeometry args={[0.02 * k * (0.6 + marks.vitiligo! * 0.8), 14, 10]} />
              <meshStandardMaterial color={shade(tone, 0.55)} transparent opacity={0.92} depthWrite={false} />
            </mesh>
          ))}
        </group>
      )}
      {marks.scars && (
        <mesh position={onFace(0.075, 0.04, 0.002)} rotation={[0, 0.4, 1.1]}>
          <capsuleGeometry args={[0.0012, 0.03 * (0.5 + marks.scars), 4, 6]} />
          <meshStandardMaterial color={shade(tone, 0.25)} />
        </mesh>
      )}
      {marks.birthmark && (
        <mesh position={onFace(-0.09, -0.08, 0.002)} scale={[1.3, 1, 0.15]}>
          <sphereGeometry args={[0.012 + marks.birthmark * 0.01, 12, 8]} />
          <meshStandardMaterial color={shade(tone, -0.25)} transparent opacity={0.7} depthWrite={false} />
        </mesh>
      )}

      {/* head piercings */}
      {a.piercings.map((p) =>
        sidesFor(p.site, p.side).map((side) => {
          const pos = headSocket(p.site, side)
          if (!pos) return null
          const ear = isEarSite(p.site)
          const industrialEnd = p.site === 'industrial' ? ([side * -0.004, -0.004, 0.036] as [number, number, number]) : undefined
          const chainEnd = p.jewellery === 'chain' && ear ? ([0, 0.08, -0.02] as [number, number, number]) : undefined
          const bridge = p.site === 'bridge' ? ([-0.024, 0, 0] as [number, number, number]) : undefined
          return (
            <group
              key={`${p.id}${side}`}
              position={p.site === 'bridge' ? [0.012, pos[1], pos[2]] : pos}
              rotation={ear ? [0, side * Math.PI / 2, 0] : [0, Math.atan2(pos[0], pos[2]), 0]}
            >
              <Jewellery p={p} plane={ear ? 'ear' : 'face'} to={industrialEnd ?? chainEnd ?? bridge} />
            </group>
          )
        }),
      )}

      <Hair look={a.hair} hideTop={hideHairTop} />
    </group>
  )
}
