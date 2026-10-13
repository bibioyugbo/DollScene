import { Vector3 } from 'three'
import type { NailLook } from '../../shared/studio/look'
import type { PropState } from '../character/props'
import type { Side } from '../character/rig'
import { fx, type NailFx } from '../state/fx'
import { localDir, localVec, landmark, type Character, type HandGoal, type Move, type MoveCtx } from './engine'
import { faceFingers } from './moves'
import type { StepCtx, StepDef } from './steps'

/**
 * The manicure: the doll holds one hand out, the other paints each nail cuticle to tip, coat by
 * coat (prep, base, colour, art, top), then they swap. The polish lives on the nail plates only
 * (see character/nails.ts); fx.nails says how far each coat has got on each nail.
 */

const ease = (t: number) => t * t * (3 - 2 * t)

/** The presenting hand: held out in front of the chest, palm down, fingers forward. */
function present(side: Side) {
  const s = side === 'Left' ? 1 : -1
  return (t: number, { c }: MoveCtx): HandGoal => {
    const neck = landmark(c, 'neck') ?? c.head.getWorldPosition(new Vector3())
    return {
      target: neck.clone().add(localVec(c, new Vector3(0.05 * s, -0.17, 0.22))),
      fingers: localDir(c, new Vector3(-0.45 * s, 0.05, 0.9)).normalize(),
      palm: localDir(c, new Vector3(0, -1, 0.1)).normalize(),
      effector: 'palm',
      grip: 'flat',
      weight: Math.min(1, t * 2.5 + 0.0001),
    }
  }
}

/** A point on nail i: along its length (0 cuticle .. 1 free edge), just above the polish. */
function nailPoint(c: Character, i: number, t: number) {
  const n = c.nails?.nails[i]
  if (!n) return null
  n.mesh.updateWorldMatrix(true, false)
  const geo = n.mesh.geometry
  if (!geo.boundingBox) geo.computeBoundingBox()
  const L = geo.boundingBox!.max.y
  const p = new Vector3(0, L * (0.08 + 0.84 * t), 0.0012).applyMatrix4(n.mesh.matrixWorld)
  const nrm = new Vector3(0, 0, 1).transformDirection(n.mesh.matrixWorld)
  return { p, n: nrm }
}

/** The painting hand: brush tip along nail i. */
function paint(_side: Side, nail: number, phase: 'in' | 'work' | 'out') {
  return (t: number, ctx: MoveCtx): HandGoal => {
    const k = phase === 'in' ? 0 : phase === 'out' ? 1 : t
    const r = nailPoint(ctx.c, nail, k) ?? { p: ctx.c.head.getWorldPosition(new Vector3()), n: localDir(ctx.c, new Vector3(0, 1, 0)) }
    const away = phase === 'in' ? 0.06 * (1 - ease(t)) : phase === 'out' ? 0.06 * ease(t) : 0
    return {
      target: r.p.addScaledVector(r.n, 0.0008 + away),
      fingers: faceFingers(0.9)(r.n, ctx),
      palm: r.n.clone().negate(),
      effector: 'pinch',
      grip: 'pinch',
      weight: phase === 'in' ? Math.min(1, t * 2) : phase === 'out' ? 1 - Math.max(0, t * 1.5 - 0.5) : 1,
      usePropTip: true,
    }
  }
}

const STAGES: { stage: NailFx['stage']; prop: PropState['id']; per: number }[] = [
  { stage: 'prep', prop: 'file', per: 0.35 },
  { stage: 'base', prop: 'nailbrush', per: 0.3 },
  { stage: 'colour', prop: 'nailbrush', per: 0.42 },
  { stage: 'art', prop: 'nailbrush', per: 0.42 },
  { stage: 'top', prop: 'nailbrush', per: 0.28 },
]

function handMoves(painted: Side, nails: number[], look: NailLook): Move[] {
  const painter: Side = painted === 'Left' ? 'Right' : 'Left'
  const hold = present(painted)
  const holdFull = (t: number, ctx: MoveCtx) => ({ ...hold(t, ctx), weight: 1 })
  const key = painted === 'Left' ? 'left' : 'right'
  const other = painter === 'Left' ? 'left' : 'right'
  const moves: Move[] = [{ dur: 0.6, [key]: hold }]
  for (const st of STAGES) {
    if (st.stage === 'art' && look.art === 'none') continue
    if (st.stage === 'colour' && look.amount < 0.01) continue
    const prop: PropState = { id: st.prop, hold: 'pinch', color: st.stage === 'art' ? look.artColor : st.stage === 'colour' ? look.color : '#f4eef0' }
    nails.forEach((i, j) => {
      const start = (t: number) => {
        fx.nails.stage = st.stage
        // nails already done in this stage stay done; the next ones wait
        for (const k of nails) fx.nails.coat[k] = nails.indexOf(k) < j ? 1 : nails.indexOf(k) === j ? ease(t) : 0
      }
      moves.push({ dur: j === 0 ? 0.5 : 0.28, [key]: holdFull, [other]: paint(painter, i, 'in'), props: { [painter]: prop }, tick: () => start(0) })
      moves.push({ dur: st.per, [key]: holdFull, [other]: paint(painter, i, 'work'), props: { [painter]: prop }, tick: start, face: () => ({ Expr_Pout: 0.15 }) })
      moves.push({ dur: 0.18, [key]: holdFull, [other]: paint(painter, i, 'out'), props: { [painter]: prop }, tick: () => start(1) })
    })
  }
  // show it off
  moves.push({ dur: 0.9, [key]: holdFull, tick: () => void (fx.nails.stage = 'top'), face: (t) => ({ Expr_Smile: 0.6 * Math.sin(t * Math.PI) }) })
  return moves
}

const chosen = (ctx: StepCtx): NailLook | null => (typeof ctx.extra?.nails === 'string' ? (JSON.parse(ctx.extra.nails) as NailLook) : null)

export const MANICURE: StepDef = {
  id: 'nails:manicure',
  name: 'Manicure',
  blurb: 'Prep, base coat, colour, nail art, top coat. Both hands.',
  framing: 'hands',
  regions: ['nails'],
  products: [],
  mode: 'preview',
  blocked: () => null,
  before: () => {
    fx.nails.stage = 'prep'
    fx.nails.coat = new Array(10).fill(0)
  },
  moves: (ctx) => {
    const nl = chosen(ctx) ?? ctx.look.nails
    return [...handMoves('Left', [1, 2, 3, 4, 0], nl), ...handMoves('Right', [6, 7, 8, 9, 5], nl)]
  },
  // the design picked in the panel (ctx.extra.nails) is previewed and painted on, coat by coat
  apply: (l, ctx) => {
    const nl = chosen(ctx)
    if (nl) l.nails = nl
  },
  done: 'Fresh set! Nails done.',
}
