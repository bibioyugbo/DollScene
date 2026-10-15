import { useGLTF } from '@react-three/drei'
import { BRAIDED, LOCS, type HairId, type StudioLook } from '../../shared/studio/look'
import { url } from '../character/catalog'
import type { PropState } from '../character/props'
import type { Side } from '../character/rig'
import { fx } from '../state/fx'
import { useStudio } from '../state/store'
import { headUp, type HandGoal, type Move, type MoveCtx } from './engine'
import { hairPoint, holdAt, onHair, SECTION_DIR } from './moves'
import type { Product, StepDef } from './steps'

/**
 * Haircare: brushing that suits the hair type, washing and conditioning, towel drying, a braid
 * takedown and a loc retwist done section by section (8 scalp sections). Hair geometry is never
 * simulated strand by strand: a takedown is a controlled, per-section transition between two
 * fitted hairstyle assets (braids → braid-out), and a retwist between two assets that share the
 * exact same loc layout (locs → retwisted locs), so length, thickness and colour stay put.
 */

const ease = (t: number) => t * t * (3 - 2 * t)
const P = (id: string, name: string, blurb: string, color: string): Product => ({ id, name, blurb, color })

export const SECTION_NAMES = ['Front left', 'Front right', 'Top left', 'Top right', 'Left side', 'Right side', 'Back left', 'Back right']

export type HairKind = 'coily' | 'braids' | 'locs' | 'straight' | 'crop'

export function hairKind(style: HairId): HairKind {
  if (style === 'none') return 'crop'
  if (LOCS.includes(style)) return 'locs'
  if (BRAIDED.includes(style) || style === 'bantu_knots') return 'braids'
  if (['afro_short', 'afro_big', 'curls', 'braid_out', 'short02', 'leave_out'].includes(style)) return 'coily'
  return 'straight'
}

/** What a takedown turns each braided style into. */
export const TAKEDOWN_TO: Partial<Record<HairId, HairId>> = { fulani_braids: 'braid_out', box_braids: 'braid_out', knotless_braids: 'braid_out', twists: 'braid_out', cornrows: 'braid_out', bantu_knots: 'braid_out', jayda_braids: 'braid_out', doechii_cornrows: 'braid_out' }
/** Retwists keep the exact loc layout. */
export const RETWIST_TO: Partial<Record<HairId, HairId>> = { locs: 'locs_retwist' }

/* ------------------------------------------------------------------ products */

export const HAIR_PRODUCTS = {
  tools: {
    coily: [P('pick', 'Afro pick', 'Lifts and shapes the volume, no breakage.', '#161214')],
    straight: [P('paddle', 'Paddle brush', 'Long, smooth strokes from crown to ends.', '#161214'), P('comb', 'Wide-tooth comb', 'Gentle detangling.', '#161214')],
    braids: [P('edge', 'Edge brush', 'Lays the edges along the hairline.', '#161214')],
    locs: [P('palm', 'Palm roll', 'Smooths each loc between the palms.', '#E8C4B8')],
    crop: [P('soft', 'Soft brush', 'Brushes the crop flat and shiny.', '#161214')],
  },
  shampoo: [P('coconut-curl', 'Coconut Curl Shampoo', 'Sulfate-free, gentle bubbles.', '#F4EDE0'), P('clarify', 'Clarifying Shampoo', 'Deep clean for build-up.', '#BFE3F7')],
  conditioner: [P('shea-slip', 'Shea Slip Conditioner', 'Rich slip for detangling.', '#F6E7CF'), P('light-silk', 'Light Silk Conditioner', 'Weightless softness.', '#F4E4EC')],
  gel: [P('edge-gel', 'Loc Gel', 'A small dab at each root.', '#C9B4E6')],
}

/* ------------------------------------------------------------------ helpers */

/** A hand working on the hair along a head-direction path, holding a prop. */
const hairMove = (side: Side, dur: number, path: (t: number) => [number, number], prop: PropState | null, opts: { out?: number | ((t: number) => number); grip?: HandGoal['grip']; effector?: HandGoal['effector']; tick?: Move['tick']; inOut?: boolean } = {}): Move => ({
  dur,
  [side === 'Left' ? 'left' : 'right']: (t: number, ctx: MoveCtx) => {
    const out = typeof opts.out === 'function' ? opts.out(t) : (opts.out ?? (prop ? 0.05 : 0.006))
    const g = onHair(side, path, { out, grip: opts.grip, effector: opts.effector })(t, ctx)
    // ease on and off the hair: never pops onto the head
    const w = opts.inOut ? Math.min(1, t * 5, (1 - t) * 5 + 0.0001) : 1
    return { ...g, weight: Math.max(0.001, w) }
  },
  props: { [side]: prop },
  tick: opts.tick,
})

const lerp2 = (a: [number, number], b: [number, number]) => (t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]

/** Swing in from rest to the start of a hair path (and back out), so hands never teleport. */
const enter = (side: Side, at: [number, number], prop: PropState | null, out = 0.05): Move => ({
  dur: 0.6,
  [side === 'Left' ? 'left' : 'right']: (t: number, ctx: MoveCtx) => ({ ...onHair(side, () => at, { out: out + 0.06 * (1 - t) })(t, ctx), weight: Math.max(0.001, ease(t)) }),
  props: { [side]: prop },
})
const leave = (side: Side, at: [number, number], prop: PropState | null, out = 0.05): Move => ({
  dur: 0.5,
  [side === 'Left' ? 'left' : 'right']: (t: number, ctx: MoveCtx) => ({ ...onHair(side, () => at, { out: out + 0.06 * t })(t, ctx), weight: Math.max(0.001, 1 - ease(t)) }),
  props: { [side]: prop },
})

/* ------------------------------------------------------------------ brushing */

export function brushStrokes(kind: HairKind, prop: PropState | null): Move[] {
  const moves: Move[] = []
  const strokes: { side: Side; a: [number, number]; b: [number, number] }[] =
    kind === 'coily'
      ? [
          // pick: short outward lifts all around
          { side: 'Right', a: [-20, 40], b: [-30, 62] },
          { side: 'Right', a: [-70, 30], b: [-80, 50] },
          { side: 'Left', a: [20, 40], b: [30, 62] },
          { side: 'Left', a: [70, 30], b: [80, 50] },
          { side: 'Right', a: [-10, 70], b: [-40, 82] },
        ]
      : kind === 'braids'
        ? [
            // edges: along the hairline at the temples and forehead
            { side: 'Right', a: [-60, 10], b: [-15, 16] },
            { side: 'Left', a: [60, 10], b: [15, 16] },
          ]
        : kind === 'locs'
          ? [
              { side: 'Right', a: [-100, 20], b: [-110, -20] },
              { side: 'Left', a: [100, 20], b: [110, -20] },
            ]
          : [
              // crown to ends: over the top and down the back and sides
              { side: 'Right', a: [-10, 80], b: [-160, 10] },
              { side: 'Right', a: [-60, 70], b: [-120, 0] },
              { side: 'Left', a: [10, 80], b: [160, 10] },
              { side: 'Left', a: [60, 70], b: [120, 0] },
            ]
  const out = kind === 'braids' ? 0.012 : kind === 'locs' ? 0.02 : 0.045
  for (const s of strokes) {
    const p = s.side === 'Left' || kind === 'locs' ? prop && { ...prop } : prop
    moves.push(enter(s.side, s.a, p, out), hairMove(s.side, kind === 'coily' ? 0.6 : 1.1, lerp2(s.a, s.b), p, { out, grip: kind === 'locs' ? 'flat' : 'hold', effector: 'palm' }), leave(s.side, s.b, p, out))
  }
  return moves
}

export const BRUSH: StepDef = {
  id: 'hair:brush',
  name: 'Brush & shape',
  blurb: 'The right tool for your hair type, crown to ends.',
  framing: 'hair',
  regions: ['hair'],
  products: [],
  mode: 'result',
  blocked: (l) => (l.hair.care.bonnet ? 'Take the bonnet off first.' : null),
  moves: ({ look, product }) => {
    const kind = hairKind(look.hair.style)
    const prop: PropState | null = kind === 'locs' ? null : { id: product.id === 'comb' || kind === 'coily' ? 'comb' : product.id === 'edge' ? 'brush' : 'hairbrush', hold: 'grip' }
    return brushStrokes(kind, prop)
  },
  apply: () => {},
  done: ({ look }) => {
    const k = hairKind(look.hair.style)
    return k === 'braids' ? 'Your braids are looking neat.' : k === 'locs' ? 'Locs smoothed.' : k === 'coily' ? 'Picked out and fluffy.' : 'Smooth and shiny.'
  },
}

/* ------------------------------------------------------------------ wash */

function massage(kind: HairKind, tick: Move['tick'], dur: number): Move[] {
  // braids and locs: fingertips on the scalp between the parts; loose hair: whole-hand massage
  const grip = kind === 'braids' || kind === 'locs' ? 'point' : 'cup'
  const effector = grip === 'point' ? 'index' : 'palm'
  const out = kind === 'coily' || kind === 'straight' ? 0.004 : 0.002
  const left: [number, number][] = [
    [40, 35],
    [50, 70],
    [100, 35],
    [140, 30],
  ]
  const moves: Move[] = [
    {
      dur: 0.6,
      left: (t, ctx) => ({ ...onHair('Left', () => left[0], { out: out + 0.06 * (1 - t), grip, effector })(t, ctx), weight: Math.max(0.001, ease(t)) }),
      right: (t, ctx) => ({ ...onHair('Right', () => [-left[0][0], left[0][1]], { out: out + 0.06 * (1 - t), grip, effector })(t, ctx), weight: Math.max(0.001, ease(t)) }),
    },
  ]
  for (let i = 0; i < left.length; i++) {
    const a = left[i]
    const b = left[Math.min(left.length - 1, i + 1)]
    const path = (t: number): [number, number] => {
      const w = Math.sin(t * Math.PI * 6) * 6
      return [a[0] + (b[0] - a[0]) * t + w, a[1] + (b[1] - a[1]) * t + w * 0.5]
    }
    moves.push({
      dur: dur / left.length,
      left: onHair('Left', path, { out, grip, effector }),
      right: onHair('Right', (t) => {
        const [az, el] = path(t)
        return [-az, el]
      }, { out, grip, effector }),
      tick: tick && ((t, ctx) => tick((i + t) / left.length, ctx)),
      face: () => ({ Expr_BlinkL: 1, Expr_BlinkR: 1, Expr_Smile: 0.2 }),
    })
  }
  moves.push({
    dur: 0.5,
    left: (t, ctx) => ({ ...onHair('Left', () => left[left.length - 1], { out: out + 0.06 * t, grip, effector })(t, ctx), weight: Math.max(0.001, 1 - ease(t)) }),
    right: (t, ctx) => ({ ...onHair('Right', () => [-left[left.length - 1][0], left[left.length - 1][1]], { out: out + 0.06 * t, grip, effector })(t, ctx), weight: Math.max(0.001, 1 - ease(t)) }),
  })
  return moves
}

const dispenseHair = (color: string, kind: 'tube' | 'gel' = 'tube'): Move[] => {
  const bottle: PropState = { id: kind, hold: 'grip', color }
  const left = holdAt('Left', { tilt: (t) => 0.6 * Math.sin(Math.min(1, t * 1.4) * Math.PI), across: 0.04 })
  const right = holdAt('Right', { across: -0.02, out: 0.27, up: 0.02, grip: 'cup', palmUp: true })
  return [
    { dur: 0.6, left, right, props: { Left: bottle } },
    { dur: 0.8, left: (t, ctx) => ({ ...left(t, ctx), weight: 1 }), right: (t, ctx) => ({ ...right(t, ctx), weight: 1 }), props: { Left: bottle } },
    { dur: 0.4, left: (t, ctx) => ({ ...left(1, ctx), weight: 1 - t }), right: (t, ctx) => ({ ...right(1, ctx), weight: 1 - t * 0.5 }), props: { Left: null } },
  ]
}

const towelPat = (from: number, to: number): Move[] => {
  const towel: PropState = { id: 'towel', hold: 'palm' }
  const spots: [number, number][] = [
    [0, 75],
    [-80, 40],
    [80, 40],
    [-150, 30],
  ]
  const moves: Move[] = [enter('Right', spots[0], towel, 0.02)]
  spots.forEach((s, i) =>
    moves.push(
      hairMove('Right', 0.55, (t) => [s[0], s[1] + Math.sin(t * Math.PI * 2) * 4], towel, {
        out: 0.02 + Math.abs(Math.sin(i)) * 0.01,
        grip: 'flat',
        tick: (t) => void (fx.hair.wet = from + (to - from) * ((i + t) / spots.length)),
      }),
      ...(i < spots.length - 1 ? [hairMove('Right', 0.35, lerp2(s, spots[i + 1]), towel, { out: 0.05, grip: 'flat' })] : []),
    ),
  )
  moves.push(leave('Right', spots[spots.length - 1], towel, 0.02))
  return moves
}

export const WASH: StepDef = {
  id: 'hair:wash',
  name: 'Wash & condition',
  blurb: 'Wet, shampoo with a scalp massage, rinse, condition, rinse, towel.',
  framing: 'hair',
  regions: ['hair', 'scalp'],
  products: HAIR_PRODUCTS.shampoo,
  options: { label: 'Conditioner', list: HAIR_PRODUCTS.conditioner.map((c) => ({ id: c.id, name: c.name })) },
  mode: 'result',
  blocked: (l) => (l.hair.care.bonnet ? 'Take the bonnet off first.' : null),
  moves: ({ look, product, option }) => {
    const kind = hairKind(look.hair.style)
    const cond = HAIR_PRODUCTS.conditioner.find((c) => c.id === option) ?? HAIR_PRODUCTS.conditioner[0]
    return [
      // water: cupped hands over the crown
      ...massage(kind, (t) => void (fx.hair.wet = ease(t)), 1.6),
      ...dispenseHair(product.color),
      ...massage(kind, (t) => void (fx.hair.foam = ease(Math.min(1, t * 1.3))), 3.2),
      // rinse
      ...massage(kind, (t) => void (fx.hair.foam = 1 - ease(t)), 1.6),
      ...dispenseHair(cond.color),
      // conditioner along the lengths (down the back and sides)
      ...[-1, 1].flatMap((s) => {
        const side: Side = s > 0 ? 'Left' : 'Right'
        return [enter(side, [s * 60, 60], null, 0.006), hairMove(side, 1.4, lerp2([s * 60, 60], [s * 140, 5]), null, { out: 0.006, grip: 'flat', tick: (t) => void (fx.hair.cream = Math.max(fx.hair.cream, 0.5 + 0.5 * t * (s > 0 ? 1 : 0.5))) }), leave(side, [s * 140, 5], null, 0.006)]
      }),
      ...massage(kind, (t) => void (fx.hair.cream = 1 - ease(t)), 1.4),
      ...towelPat(1, 0.35),
    ]
  },
  apply: (l) => {
    l.hair.care.wet = 0.35
  },
  verify: (l) => l.hair.care.wet > 0.3,
  done: 'Squeaky clean and soft.',
}

export const DRY: StepDef = {
  id: 'hair:dry',
  name: 'Towel dry',
  blurb: 'Pat and scrunch until it’s dry.',
  framing: 'hair',
  regions: ['hair'],
  products: [],
  mode: 'result',
  blocked: (l) => (l.hair.care.wet > 0.01 ? null : 'Your hair is already dry.'),
  moves: ({ look }) => towelPat(look.hair.care.wet, 0),
  apply: (l) => void (l.hair.care.wet = 0),
  verify: (l) => l.hair.care.wet === 0,
  done: 'Dry and ready to style.',
}

/* ------------------------------------------------------------------ section work */

const ALL = 255

function nextSections(l: StudioLook, target: string | null): number[] {
  const done = l.hair.care.change?.sections ?? 0
  const todo = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !(done & (1 << i)))
  if (target === 'all' || target === null) return todo
  const i = Number(target)
  return todo.includes(i) ? [i] : []
}

/** The hand that works a section: her left side with the left hand. */
const sideFor = (i: number): Side => (SECTION_DIR[i][0] >= 0 ? 'Left' : 'Right')

function startChange(kind: 'takedown' | 'retwist', to: HairId) {
  const s = useStudio.getState()
  const ch = s.look.hair.care.change
  if (ch && ch.kind === kind) return
  useGLTF.preload(url.hair(to))
  s.apply((l) => void (l.hair.care.change = { kind, from: l.hair.style, to, sections: 0 }))
}

function finishSections(l: StudioLook, done: number[]) {
  const ch = l.hair.care.change
  if (!ch) return
  for (const i of done) ch.sections |= 1 << i
  if (ch.sections === ALL) {
    l.hair.style = ch.to
    l.hair.care.change = null
  }
}

const sectionTargets = (l: StudioLook) => {
  const done = l.hair.care.change?.sections ?? 0
  return [{ id: 'all', name: 'Whole head' }, ...SECTION_NAMES.map((name, i) => ({ id: String(i), name })).filter((x) => !(done & (1 << Number(x.id))))]
}

export const TAKEDOWN: StepDef = {
  id: 'hair:takedown',
  name: 'Take down braids',
  blurb: 'Loosen one section at a time into a fluffy braid-out.',
  note: 'Switches between two fitted hairstyles section by section; it isn’t a strand simulation.',
  framing: 'hair',
  regions: ['hair'],
  products: [],
  mode: 'result',
  targets: sectionTargets,
  blocked: (l) => {
    if (l.hair.care.bonnet) return 'Take the bonnet off first.'
    const from = l.hair.care.change?.kind === 'takedown' ? l.hair.care.change.from : l.hair.style
    return TAKEDOWN_TO[from] ? null : 'Takedowns are for braids, twists, cornrows and knots.'
  },
  before: ({ look }) => startChange('takedown', TAKEDOWN_TO[look.hair.care.change?.from ?? look.hair.style] ?? 'braid_out'),
  moves: ({ look, target }) => {
    const moves: Move[] = []
    for (const i of nextSections(look, target)) {
      const side = sideFor(i)
      const [az, el] = SECTION_DIR[i]
      const s = Math.sign(az) || 1
      // pinch a braid, pull it out and down while the fingers wiggle it loose
      moves.push(enter(side, [az, el], null, 0.008))
      moves.push(
        hairMove(side, 1.6, (t) => [az + s * 18 * t + Math.sin(t * 22) * 3, el - 30 * t], null, {
          out: (t) => 0.008 + 0.05 * t,
          grip: 'pinch',
          effector: 'pinch',
          tick: (t) => void (fx.hair.sections[i] = ease(t)),
        }),
      )
      moves.push(leave(side, [az + s * 18, el - 30], null, 0.058))
    }
    return moves
  },
  apply: (l, { target }) => finishSections(l, nextSections(l, target)),
  verify: (l, { look, target }) => {
    const want = nextSections(look, target)
    return !l.hair.care.change || want.every((i) => (l.hair.care.change!.sections & (1 << i)) !== 0)
  },
  done: (ctx) => (ctx.target === 'all' ? 'All the braids are out. Hello, braid-out!' : `${SECTION_NAMES[Number(ctx.target)] ?? 'Section'} loosened.`),
}

export const RETWIST: StepDef = {
  id: 'hair:retwist',
  name: 'Retwist locs',
  blurb: 'Part, a dab of gel at the root, twist. Section by section.',
  framing: 'hair',
  regions: ['scalp', 'roots'],
  products: HAIR_PRODUCTS.gel,
  mode: 'result',
  targets: sectionTargets,
  blocked: (l) => {
    if (l.hair.care.bonnet) return 'Take the bonnet off first.'
    if (l.hair.style === 'locs_retwist' && !l.hair.care.change) return 'Freshly retwisted already: the roots are neat.'
    const from = l.hair.care.change?.kind === 'retwist' ? l.hair.care.change.from : l.hair.style
    return RETWIST_TO[from] ? null : LOCS.includes(from) ? 'Retwisting is ready for traditional locs; these locs keep their own texture.' : 'Retwists are for locs.'
  },
  before: ({ look }) => startChange('retwist', RETWIST_TO[look.hair.care.change?.from ?? look.hair.style] ?? 'locs_retwist'),
  moves: ({ look, target, product }) => {
    const moves: Move[] = []
    const comb: PropState = { id: 'comb', hold: 'pinch' }
    const gel: PropState = { id: 'dollop', hold: 'pinch', load: 1, color: product.color }
    for (const i of nextSections(look, target)) {
      const side = sideFor(i)
      const [az, el] = SECTION_DIR[i]
      const s = Math.sign(az) || 1
      // 1. part the section with the comb tail
      moves.push(enter(side, [az - s * 12, el + 10], comb, 0.004))
      moves.push(hairMove(side, 0.7, lerp2([az - s * 12, el + 10], [az + s * 12, el - 10]), comb, { out: 0.004, grip: 'pinch', effector: 'pinch' }))
      // 2. a dab of gel at the roots
      moves.push(hairMove(side, 0.6, (t) => [az, el + Math.sin(t * Math.PI * 3) * 2], gel, { out: 0.003, grip: 'point', effector: 'index', tick: (t) => void (gel.load = 1 - t * 0.5) }))
      // 3. palm-roll the roots: the fingers roll around the loc while the new roots appear
      moves.push(
        hairMove(side, 1.5, (t) => [az + Math.sin(t * Math.PI * 8) * 4, el - 4 * t], null, {
          out: 0.004,
          grip: 'pinch',
          effector: 'pinch',
          tick: (t) => void (fx.hair.sections[i] = ease(t)),
        }),
      )
      moves.push(leave(side, [az, el - 4], null, 0.004))
    }
    return moves
  },
  apply: (l, { target }) => finishSections(l, nextSections(l, target)),
  verify: (l, { look, target }) => {
    const want = nextSections(look, target)
    return !l.hair.care.change || want.every((i) => (l.hair.care.change!.sections & (1 << i)) !== 0)
  },
  done: (ctx) => (ctx.target === 'all' ? 'Fresh retwist: clean parts, neat roots.' : `${SECTION_NAMES[Number(ctx.target)] ?? 'Section'} retwisted.`),
}

export const BONNET_ON: StepDef = {
  id: 'hair:bonnetOn',
  name: 'Put on the bonnet',
  blurb: 'Satin for the night.',
  framing: 'hair',
  regions: ['hair'],
  products: [],
  mode: 'result',
  blocked: (l) => (l.hair.care.bonnet ? 'The bonnet is already on.' : null),
  moves: () => {
    const down = (side: Side) => (t: number, ctx: MoveCtx): HandGoal => {
      const top = hairPoint(ctx.c, side === 'Left' ? 70 : -70, 55, 0.03 + 0.12 * (1 - ease(t)))
      return { target: top.p, fingers: headUp(ctx.c).addScaledVector(top.n, -0.5).normalize(), palm: top.n.clone().negate(), effector: 'palm', grip: 'cup', weight: Math.min(1, t * 2.5) }
    }
    return [{ dur: 1.5, left: down('Left'), right: down('Right') }]
  },
  apply: (l) => void (l.hair.care.bonnet = true),
  verify: (l) => l.hair.care.bonnet,
  done: 'Bonnet on. Your hair says thank you.',
}

