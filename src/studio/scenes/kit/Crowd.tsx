import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { CHARACTER_PRESETS, randomDoll } from '../../../shared/studio/presets'
import type { StudioLook } from '../../../shared/studio/look'
import { useCatalog, wearables, type CharacterCatalog } from '../../character/catalog'
import { StudioCharacter } from '../../character/StudioCharacter'
import { useRealtime } from '../../net/realtime'
import { useStudio, type ExpressionPreset, type PoseId } from '../../state/store'
import type { V3 } from '../types'
import { pick, range, rng, type Rand } from './core'

/**
 * Guests at a scene: where they stand (scattered clear of the photo spots), which way they face,
 * and what they're doing. Drawn as real dolls (see Crowd below).
 */

export type Pose = 'stand' | 'dance' | 'cheer' | 'drink' | 'selfie' | 'sit'
export type Accessory = 'none' | 'mask' | 'gele' | 'fila' | 'shades' | 'sunhat' | 'party' | 'witch' | 'horns' | 'ears' | 'cap'

export interface Person {
  p: V3
  rotY: number
  h: number
  skin: string
  top: string
  bottom: string
  hair: string
  hairStyle: 'afro' | 'bun' | 'long' | 'short' | 'braids'
  pose: Pose
  acc: Accessory
  accColor: string
  dress: boolean
}

export const SKINS = ['#2B1A14', '#3B241A', '#4E2F20', '#613B28', '#7E5238', '#9C6B4A', '#B78764', '#D0A684', '#E3C5A9', '#EFDAC5']
const HAIRS = ['#0A0A0C', '#141010', '#2A1A12', '#3A2418', '#6B3A22', '#B9854A', '#5E1A26']

/** A random guest. `palette` = outfit colours for the scene. */
export function guest(r: Rand, p: V3, palette: string[], poses: Pose[], accs: Accessory[], accColors: string[] = palette): Person {
  return {
    p,
    rotY: range(r, -0.6, 0.6),
    h: range(r, 1.55, 1.85),
    skin: pick(r, SKINS),
    top: pick(r, palette),
    bottom: pick(r, ['#1a1a24', '#2a2a3a', pick(r, palette), '#e8e2d6']),
    hair: pick(r, HAIRS),
    hairStyle: pick(r, ['afro', 'bun', 'long', 'short', 'braids'] as const),
    pose: pick(r, poses),
    acc: pick(r, accs),
    accColor: pick(r, accColors),
    dress: r() < 0.45,
  }
}

/** Positions scattered in a box, kept clear of the photo spots and of the camera lane in front of each. */
export function scatter(r: Rand, n: number, box: [number, number, number, number], clear: { p: V3; r: number }[]): V3[] {
  const out: V3[] = []
  let tries = 0
  while (out.length < n && tries++ < n * 60) {
    const x = range(r, box[0], box[1])
    const z = range(r, box[2], box[3])
    // never around a photo spot, and never in the camera's lane in front of it (+Z)
    if (clear.some((c) => Math.hypot(x - c.p[0], z - c.p[2]) < c.r || (Math.abs(x - c.p[0]) < 2.3 && z > c.p[2] - 0.8))) continue
    if (out.some((o) => Math.hypot(x - o[0], z - o[2]) < 0.55)) continue
    out.push([x, 0, z])
  }
  return out
}

/** Crowd poses on the dolls' own pose set (sitting guests aren't drawn: no seat to sit on). */
const POSE_OF: Record<Pose, PoseId> = { stand: 'relaxed', dance: 'wave', cheer: 'peace', drink: 'relaxed', selfie: 'selfie', sit: 'relaxed' }
const FACE_OF: Record<Pose, ExpressionPreset> = { stand: 'soft', dance: 'laugh', cheer: 'laugh', drink: 'smile', selfie: 'smile', sit: 'soft' }

/** A guest's doll: one of the cast (never the player's own doll), or now and then a random one. */
function guestLook(person: Person, i: number, own: string, catalog: CharacterCatalog): StudioLook {
  const r = rng(Math.round(person.p[0] * 97 + person.p[2] * 31) + i * 13)
  const cast = CHARACTER_PRESETS.filter((c) => c.id !== own)
  const base =
    r() < 0.7
      ? cast[Math.floor(r() * cast.length) % cast.length].look
      : randomDoll(Math.floor(r() * 1e9), { hair: catalog.hair.map((h) => h.id), pieces: [...wearables(catalog).values()].map((w) => ({ id: w.id, slot: w.slot, colors: w.colors })) }).look
  const look = structuredClone(base)
  // a drink in hand for the drinkers; nothing else carried (their hands are posing)
  look.extras.held = person.pose === 'drink' ? 'matcha' : 'none'
  return look
}

/**
 * Party people: the same 3D dolls as the cast (the real character, not stand-ins), standing at
 * the guest spots nearest the action, each striking the scene's pose (waving, cheering, a selfie,
 * a drink in hand). Fewer on phones; fewer still when real players are there (they take the slots).
 */
export function Crowd({ people, animate }: { people: Person[]; animate: boolean; flash?: boolean }) {
  const { catalog } = useCatalog()
  const own = useStudio((s) => s.look.profile.starter)
  const peers = useRealtime((s) => Object.keys(s.peers).length)
  const wide = typeof window !== 'undefined' && window.innerWidth >= 900
  const n = Math.max(2, (wide ? 6 : 4) - peers)
  const chosen = useMemo(
    () =>
      people
        .filter((p) => p.pose !== 'sit')
        .sort((a, b) => Math.hypot(a.p[0], a.p[2]) - Math.hypot(b.p[0], b.p[2]))
        .slice(0, n),
    [people, n],
  )
  const looks = useMemo(() => (catalog ? chosen.map((p, i) => guestLook(p, i, own, catalog)) : []), [chosen, own, catalog])
  if (!catalog) return null
  return (
    <group>
      {chosen.map((p, i) => (
        <group key={`${p.p[0]}:${p.p[2]}`} position={p.p} rotation={[0, p.rotY, 0]}>
          <Quiet>
            <Suspense fallback={null}>
              <StudioCharacter look={looks[i]} catalog={catalog} animate={animate} remote pose={POSE_OF[p.pose]} expression={FACE_OF[p.pose]} />
            </Suspense>
          </Quiet>
        </group>
      ))}
    </group>
  )
}

class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
