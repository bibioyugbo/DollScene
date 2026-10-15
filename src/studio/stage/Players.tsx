import { Html } from '@react-three/drei'
import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Group } from 'three'
import type { CharacterCatalog } from '../character/catalog'
import { StudioCharacter } from '../character/StudioCharacter'
import { useRealtime, type ChatMsg, type Peer } from '../net/realtime'
import { EXPRESSION_PRESETS, POSES, type ExpressionPreset, type PoseId } from '../state/store'

/**
 * The other real players at this scene, as their own dolls. Each stands in a slot around the
 * player's photo spot (chosen by their id, so everyone keeps their place), turned a little toward
 * the camera, striking the pose and face they've picked, with a name tag and a speech bubble for
 * whatever they last said. At most MAX are drawn (the most recent arrivals wait their turn).
 */

const MAX = 6
/** Slots around the photo spot (x across, z back), clear of the camera lane in front of her. */
/**
 * Slots around the photo spot in her own frame (x across, z toward the camera): beside her and a
 * half step forward (props such as arches and booths sit behind the spot), then further out, then
 * behind her shoulders. Never in the camera's lane straight in front of her.
 */
const SLOTS: [number, number][] = [
  [-0.95, 0.25],
  [0.95, 0.25],
  [-1.65, -0.25],
  [1.65, -0.25],
  [-0.6, -1.1],
  [0.6, -1.1],
]

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function Bubble({ msg, me }: { msg: ChatMsg | undefined; me?: boolean }) {
  // a bubble fades a few seconds after it was said (longer messages stay a little longer)
  const [hidden, setHidden] = useState<string | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = window.setTimeout(() => setHidden(msg.id), Math.min(9000, 3500 + msg.text.length * 60))
    return () => window.clearTimeout(t)
  }, [msg])
  if (!msg || hidden === msg.id) return null
  return (
    <div className={`ds-bubble ${me ? 'ds-bubble--me' : ''} ${msg.forMe ? 'ds-bubble--ping' : ''}`}>
      {msg.text.split(/(@[\p{L}\p{N}_.'-]{1,24})/u).map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="font-black text-[#c2185b]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  )
}

function RemoteDoll({ peer, slot, catalog, onTap }: { peer: Peer; slot: [number, number]; catalog: CharacterCatalog; onTap: (p: Peer) => void }) {
  const g = useRef<Group>(null)
  const bubble = useRealtime((s) => s.bubbles[peer.id])
  const pose = (POSES as readonly string[]).includes(peer.state.pose) ? (peer.state.pose as PoseId) : 'relaxed'
  const expr = (EXPRESSION_PRESETS as readonly string[]).includes(peer.state.expr) ? (peer.state.expr as ExpressionPreset) : 'smile'
  const h = peer.look?.height ?? 1
  // (no scale-in on arrival: jewellery is fitted to the doll's measured size on its first frames)
  if (!peer.look) return null
  return (
    <group ref={g} position={[slot[0], 0, slot[1]]} rotation={[0, -slot[0] * 0.18, 0]} onClick={(e) => (e.stopPropagation(), onTap(peer))}>
      <Quiet>
        <Suspense fallback={null}>
          <StudioCharacter look={peer.look} catalog={catalog} animate remote pose={pose} expression={expr} />
        </Suspense>
      </Quiet>
      <Html position={[0, 1.78 * h + 0.18, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center gap-1.5">
          <Bubble msg={bubble} />
          <span className="whitespace-nowrap rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-extrabold text-white backdrop-blur">{peer.name}</span>
        </div>
      </Html>
    </group>
  )
}

export function Players({ catalog, at, onTap }: { catalog: CharacterCatalog; at: { position: [number, number, number]; rotationY: number }; onTap: (p: Peer) => void }) {
  const peers = useRealtime((s) => s.peers)
  const list = Object.values(peers)
    .filter((p) => p.look)
    .slice(0, MAX)
  // stable slots: by id, resolving collisions in order
  const taken = new Set<number>()
  const placed = list.map((p) => {
    let k = hash(p.id) % SLOTS.length
    while (taken.has(k)) k = (k + 1) % SLOTS.length
    taken.add(k)
    return { p, slot: SLOTS[k] }
  })
  return (
    <group position={at.position} rotation={[0, at.rotationY, 0]}>
      {placed.map(({ p, slot }) => (
        <RemoteDoll key={p.id} peer={p} slot={slot} catalog={catalog} onTap={onTap} />
      ))}
    </group>
  )
}
