import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Group } from 'three'
import { LUGGAGE_BY_ID, type LuggageDef } from '../../shared/movein'

/** The red, blue and white check of a Ghana Must Go bag. */
function gmgTexture(color: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#F4F1EA'
  g.fillRect(0, 0, 64, 64)
  g.globalAlpha = 0.85
  g.fillStyle = color
  for (let i = 0; i < 64; i += 16) {
    g.fillRect(i, 0, 7, 64)
    g.fillRect(0, i, 64, 7)
  }
  g.globalAlpha = 0.5
  g.fillStyle = color === '#2B4BAA' ? '#C0392B' : '#2B4BAA'
  for (let i = 8; i < 64; i += 16) {
    g.fillRect(i, 0, 3, 64)
    g.fillRect(0, i, 64, 3)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(2, 1.5)
  return t
}

function Bag({ def }: { def: LuggageDef }) {
  const tex = useMemo(() => gmgTexture(def.color), [def.color])
  return (
    <group>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.7, 0.44, 0.38]} />
        <meshStandardMaterial map={tex} roughness={0.55} />
      </mesh>
      {/* zip and handles */}
      <mesh position={[0, 0.445, 0]}>
        <boxGeometry args={[0.66, 0.012, 0.03]} />
        <meshStandardMaterial color="#222" metalness={0.6} roughness={0.3} />
      </mesh>
      {[-0.12, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.07, 0.012, 6, 12, Math.PI]} />
          <meshStandardMaterial color={def.color} />
        </mesh>
      ))}
    </group>
  )
}

function Suitcase({ def }: { def: LuggageDef }) {
  return (
    <group>
      <mesh position={[0, 0.34, 0]} castShadow>
        <boxGeometry args={[0.46, 0.6, 0.24]} />
        <meshStandardMaterial color={def.color} metalness={0.25} roughness={0.35} />
      </mesh>
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.34, 0.121]}>
          <boxGeometry args={[0.02, 0.56, 0.005]} />
          <meshStandardMaterial color="#000" transparent opacity={0.15} />
        </mesh>
      ))}
      {/* telescopic handle and wheels */}
      <mesh position={[0, 0.74, 0]}>
        <boxGeometry args={[0.2, 0.03, 0.03]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      {[-0.08, 0.08].map((x) => (
        <mesh key={x} position={[x, 0.69, 0]}>
          <boxGeometry args={[0.015, 0.1, 0.015]} />
          <meshStandardMaterial color="#888" metalness={0.8} />
        </mesh>
      ))}
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.03, 0.08]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.03, 10]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  )
}

function Box({ def }: { def: LuggageDef }) {
  return (
    <group>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.5, 0.4, 0.42]} />
        <meshStandardMaterial color={def.color} roughness={0.95} />
      </mesh>
      {/* packing tape and a "FRAGILE" stripe */}
      <mesh position={[0, 0.401, 0]}>
        <boxGeometry args={[0.1, 0.004, 0.43]} />
        <meshStandardMaterial color="#D9B88A" transparent opacity={0.85} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.25, 0.211]}>
        <planeGeometry args={[0.3, 0.06]} />
        <meshStandardMaterial color="#C0392B" />
      </mesh>
    </group>
  )
}

/** A clickable piece of luggage. It bobs to say "tap me" and pops when unpacked. */
function Luggage({ def, onUnpack, reducedMotion, arriveAt, from }: { def: LuggageDef; onUnpack: (id: string) => void; reducedMotion: boolean; arriveAt: number | null; from: [number, number] }) {
  const ref = useRef<Group>(null)
  const [hover, setHover] = useState(false)
  const [busy, setBusy] = useState(false)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    // Arc in from the truck at the front edge.
    if (arriveAt != null && t < arriveAt + 0.9 && !reducedMotion) {
      const k = Math.max(0, (t - arriveAt) / 0.9)
      g.visible = t >= arriveAt
      g.position.set(def.spot[0] * k + from[0] * (1 - k), 0.6 * (1 - k) + Math.sin(k * Math.PI) * 1.4, def.spot[1] * k + from[1] * (1 - k))
      g.rotation.y = (1 - k) * 3
      return
    }
    g.visible = true
    g.position.set(def.spot[0], reducedMotion ? 0 : Math.max(0, Math.sin(t * 2.4 + def.spot[0]) * 0.04), def.spot[1])
    g.rotation.y = def.spot[0] * 0.3
    const s = busy ? 0.85 : hover ? 1.08 : 1
    g.scale.setScalar(g.scale.x + (s - g.scale.x) * 0.2)
  })
  const click = async (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || busy) return
    setBusy(true)
    try {
      await onUnpack(def.id)
    } finally {
      setBusy(false)
    }
  }
  return (
    <group
      ref={ref}
      position={[def.spot[0], 0, def.spot[1]]}
      visible={arriveAt == null}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      {def.kind === 'ghana-must-go' ? <Bag def={def} /> : def.kind === 'suitcase' ? <Suitcase def={def} /> : <Box def={def} />}
    </group>
  )
}

/** Low-poly Lagos removal truck: drives up the open side, drops the load, reverses out. */
function Truck({ x, onDrop, onDone, reducedMotion }: { x: number; onDrop: (t: number) => void; onDone: () => void; reducedMotion: boolean }) {
  const ref = useRef<Group>(null)
  const start = useRef<number | null>(null)
  const dropped = useRef(false)
  const done = useRef(false)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const t = clock.elapsedTime
    if (start.current == null) start.current = t
    const e = t - start.current
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3)
    let z: number
    if (reducedMotion) {
      z = 0
      if (!dropped.current) {
        dropped.current = true
        onDrop(t)
      }
      if (e > 0.5 && !done.current) {
        done.current = true
        onDone()
      }
      g.visible = e < 0.5
    } else if (e < 2) z = -16 + 16 * ease(e / 2)
    else if (e < 4.4) {
      z = 0
      if (!dropped.current) {
        dropped.current = true
        onDrop(t)
      }
    } else {
      z = -16 * Math.pow(Math.min(1, (e - 4.4) / 2), 2)
      if (e > 6.4 && !done.current) {
        done.current = true
        onDone()
      }
    }
    g.position.set(x, reducedMotion ? 0 : Math.abs(Math.sin(e * 18)) * 0.015, z)
  })
  const wheel = (x: number, zz: number) => (
    <mesh key={`${x}-${zz}`} position={[x, 0.28, zz]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.28, 0.28, 0.2, 14]} />
      <meshStandardMaterial color="#141414" roughness={0.9} />
    </mesh>
  )
  return (
    <group ref={ref} position={[x, 0, -16]} rotation={[0, Math.PI / 2, 0]} scale={0.8}>
      {/* cargo box: "DollScene Movers" pink with the yellow Lagos stripe */}
      <mesh position={[0.6, 1.25, 0]} castShadow>
        <boxGeometry args={[3, 1.9, 1.7]} />
        <meshStandardMaterial color="#FF2E88" roughness={0.5} />
      </mesh>
      <mesh position={[0.6, 0.55, 0.851]}>
        <planeGeometry args={[3, 0.18]} />
        <meshStandardMaterial color="#F5C518" />
      </mesh>
      <mesh position={[0.6, 0.55, -0.851]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[3, 0.18]} />
        <meshStandardMaterial color="#F5C518" />
      </mesh>
      {/* cab */}
      <mesh position={[-1.45, 0.95, 0]} castShadow>
        <boxGeometry args={[1.1, 1.3, 1.6]} />
        <meshStandardMaterial color="#F5C518" roughness={0.4} />
      </mesh>
      <mesh position={[-1.95, 1.25, 0]}>
        <boxGeometry args={[0.12, 0.55, 1.4]} />
        <meshStandardMaterial color="#9AD7FF" metalness={0.4} roughness={0.1} />
      </mesh>
      <mesh position={[-2.02, 0.55, 0]}>
        <boxGeometry args={[0.06, 0.25, 1.5]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {wheel(-1.4, 0.8)}
      {wheel(-1.4, -0.8)}
      {wheel(1.4, 0.8)}
      {wheel(1.4, -0.8)}
    </group>
  )
}

/**
 * Move-in day. With `truck` the luggage arrives on the truck and arcs into the
 * room; otherwise whatever is still packed just sits in the crib waiting to be opened.
 */
export function MoveIn({ luggage, truck, width, onUnpack, onTruckDone, reducedMotion }: { luggage: string[]; truck: boolean; width: number; onUnpack: (id: string) => void; onTruckDone: () => void; reducedMotion: boolean }) {
  const [dropAt, setDropAt] = useState<number | null>(null)
  const [driving, setDriving] = useState(truck)
  const defs = luggage.map((id) => LUGGAGE_BY_ID.get(id)).filter((d): d is LuggageDef => !!d)
  return (
    <group>
      {driving && (
        <Truck
          x={width / 2 + 1.5}
          reducedMotion={reducedMotion}
          onDrop={setDropAt}
          onDone={() => {
            setDriving(false)
            onTruckDone()
          }}
        />
      )}
      {defs.map((def, i) => (
        <Luggage key={def.id} def={def} onUnpack={onUnpack} reducedMotion={reducedMotion} arriveAt={driving ? (dropAt == null ? Infinity : dropAt + i * 0.28) : null} from={[width / 2 + 0.6, 0]} />
      ))}
      {/* a lane beside the crib so the truck has somewhere to drive */}
      {driving && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2 + 1.5, -0.01, -8]}>
          <planeGeometry args={[2.4, 24]} />
          <meshStandardMaterial color="#3A3A40" roughness={0.95} />
        </mesh>
      )}
    </group>
  )
}
