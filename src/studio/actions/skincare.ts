import { Vector3 } from 'three'
import { CLEAR_SKIN, DEFAULT_MAKEUP, type CareStep, type SkinCare, type SpotId, type StudioLook } from '../../shared/studio/look'
import { effectorPoint } from '../character/rig'
import { fx, type Region } from '../state/fx'
import type { PropState } from '../character/props'
import { headUp, landmark, landmarkNormal, localDir, localVec, type HandGoal, type Move, type MoveCtx } from './engine'
import { along, at, both, circles, glide, holdAt, holding, stretch, stroke, taps, type Contact } from './moves'
import type { Product, StepDef } from './steps'
import { showResult } from '../ui/results'
import { haptic, sfx } from '../ui/sound'

/**
 * The morning routine: wake up, then skincare steps A–J and the finish (K). Products are
 * fictional in-game cosmetics: they change how the doll looks, nothing more.
 */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))
const ease = (t: number) => t * t * (3 - 2 * t)
const SPOT_NAME: Record<SpotId, string> = {
  forehead1: 'Forehead (right)',
  forehead2: 'Forehead (left)',
  cheekL: 'Left cheek',
  cheekR: 'Right cheek',
  chin: 'Chin',
  nose: 'Beside the nose',
  jawR: 'Jawline',
  cheekL2: 'Lower left cheek',
}
const markDone = (l: StudioLook, s: CareStep) => {
  if (!l.care.done.includes(s)) l.care.done.push(s)
}

/** A point just off a spot toward the side (where fingers pinch a patch edge). */
const spotEdge =
  (id: SpotId, dist: number, sign = 1): Contact =>
  (t, ctx) => {
    const r = at(`spot:${id}`)(t, ctx)
    const side = new Vector3().crossVectors(r.n, headUp(ctx.c)).normalize()
    return { p: r.p.addScaledVector(side, dist * sign), n: r.n }
  }

const raise = (region: Region | Region[], key: 'foam' | 'wet' | 'cream' | 'sheen', to: number) => (t: number) => {
  for (const r of Array.isArray(region) ? region : [region]) fx.skin[key][r] = Math.max(fx.skin[key][r], to * ease(t))
}
const fade = (keys: ('foam' | 'wet' | 'cream' | 'sheen')[], from: number, to: number) => (t: number) => {
  for (const k of keys) for (const r of Object.keys(fx.skin[k]) as Region[]) fx.skin[k][r] = Math.min(fx.skin[k][r], from + (to - from) * ease(t))
}
const pause = (dur: number, tick?: Move['tick'], face?: Move['face']): Move => ({ dur, tick, face })
const closedEyes = () => ({ Expr_BlinkL: 1, Expr_BlinkR: 1 })

/** Dispense product from a bottle in the left hand onto the right fingertip. */
function dispense(prop: Product, kind: 'cleanser' | 'tube' | 'jar' | 'sunscreen', dur = 1.1): Move[] {
  const bottle: PropState = { id: kind, hold: kind === 'jar' ? 'palm' : 'grip', color: prop.color }
  const dollop: PropState = { id: 'dollop', hold: 'pinch', load: 0 }
  const left = holdAt('Left', { tilt: kind === 'jar' ? undefined : (t) => 0.5 * Math.sin(Math.min(1, t * 1.5) * Math.PI), palmUp: kind === 'jar', across: 0.04 })
  const right = (t: number, ctx: MoveCtx): HandGoal => ({ ...holdAt('Right', { across: -0.02, out: 0.27, up: 0.04, grip: 'point', palmUp: true })(t, ctx), effector: 'index' })
  return [
    { dur: 0.6, left, right, props: { Left: bottle, Right: null } },
    {
      dur,
      left: (t, ctx) => ({ ...left(t, ctx), weight: 1 }),
      right: (t, ctx) => ({ ...right(t, ctx), weight: 1 }),
      props: { Left: bottle, Right: dollop },
      tick: (t) => void (dollop.load = ease(t)),
    },
  ]
}

/* ------------------------------------------------------------------ products */

const P = (id: string, name: string, blurb: string, color: string): Product => ({ id, name, blurb, color })

export const PRODUCTS = {
  fingers: [P('fingers', 'Clean fingertips', 'Gentle, slow and careful.', '#E8C4B8')],
  cleanser: [P('cloud-foam', 'Cloud Foam Cleanser', 'Rich bubbles that rinse clean.', '#9FD8C4'), P('melt-balm', 'Melt Balm', 'Melts off sunscreen and makeup.', '#F4D9A8'), P('micellar', 'Micellar Water', 'No rinse: wipe with a cotton pad.', '#D8E8F6')],
  spot: [P('dot-gel', 'Tea Tree Dot Gel', 'A tiny clear dab on one spot.', '#CFE8D0'), P('calm-cream', 'Calm Spot Cream', 'A soothing dot that dries down.', '#F2E6DA')],
  toner: [P('rose-water', 'Rose Water Toner', 'A soft, fresh mist of hydration.', '#F7C6D6'), P('glow-toner', 'Glow Toner', 'Smooths and brightens.', '#F2DCA0'), P('calm-toner', 'Calm Toner', 'Cools redness down.', '#C9E6F2')],
  serum: [
    P('hydra-drops', 'Hydra Drops', 'Hydrating serum: plump and bouncy.', '#BFE3F7'),
    P('bright-10', 'Bright 10', 'Niacinamide-style serum: smoother looking skin.', '#F1E7C9'),
    P('glow-oil', 'Glow Oil', 'Facial oil: a lit-from-within sheen.', '#E9B95A'),
    P('eye-wake', 'Eye Wake Serum', 'Light drops for the under-eyes.', '#E5D4F2'),
    P('spot-serum', 'Clear Spot Serum', 'Calms every visible spot at once.', '#D3EED2'),
  ],
  eyeCream: [P('wide-awake', 'Wide Awake Eye Cream', 'Brightens the under-eye area.', '#F4EDE6'), P('cool-gel', 'Cool Caffeine Gel', 'A cooling, de-puffing gel.', '#DDEBF5')],
  moisturiser: [P('cloud-cream', 'Cloud Cream', 'Light, everyday hydration.', '#FBF6F0'), P('gel-cream', 'Gel Cream', 'Water-light and fresh.', '#E3F1F5'), P('butter-cream', 'Rich Butter Cream', 'Deep comfort for dry days.', '#F6E7CF')],
  sunscreen: [P('invisible-50', 'Invisible SPF 50', 'Sheer fluid, no white cast.', '#FFE2B0'), P('mineral-30', 'Mineral SPF 30', 'A soft white finish that sets.', '#FFFFFF')],
  balm: [P('clear-balm', 'Clear Balm', 'Smooth, soft lips.', '#F2E6DA'), P('tinted-balm', 'Tinted Balm', 'A sheer berry wash.', '#B24A5A'), P('gloss-balm', 'Gloss Balm', 'Soft lips with a glassy shine.', '#F0B8C8')],
  scrub: [P('sugar-scrub', 'Brown Sugar Scrub', 'Gentle grains lift dry flakes.', '#C99A6A')],
  soothe: [P('aloe-gel', 'Aloe Calm Gel', 'Cool gel for red, bumpy patches.', '#9FD8A8')],
  brighten: [P('vit-c', 'Vitamin C Bright Serum', 'Fades dark marks and patches.', '#F2A33A')],
  compress: [P('warm-cloth', 'Warm Compress', 'Gentle heat brings a boil to a head.', '#F4C3A1')],
}

/* ------------------------------------------------------------------ morning */

/** The just-woke-up look: sleepy eyes, bare skin, optional patches, spots, dark circles and the bonnet. */
export function morningLook(l: StudioLook, o: { patches: number; spots: number; underEye: boolean; bonnet: boolean }) {
  const ids: SpotId[] = ['cheekL', 'forehead1', 'chin', 'cheekR', 'nose', 'forehead2', 'jawR', 'cheekL2']
  const spots: SkinCare['spots'] = {}
  for (const id of ids.slice(0, Math.max(o.spots, o.patches))) spots[id] = 'pimple'
  l.care = {
    ...structuredClone(CLEAR_SKIN),
    morning: true,
    patches: ids.slice(0, o.patches),
    spots,
    underEye: o.underEye ? 0.6 : 0.2,
    texture: 0.45,
    hydration: 0.25,
    glow: 0.12,
    lips: 0.2,
    eyePatches: true,
  }
  l.makeup = structuredClone(DEFAULT_MAKEUP)
  l.hair.care.bonnet = o.bonnet
}

export const WAKE: StepDef = {
  id: 'wake',
  name: 'Wake up',
  blurb: 'A big stretch and a yawn.',
  framing: 'bust',
  regions: ['body'],
  products: PRODUCTS.fingers,
  mode: 'result',
  moves: () => [
    { dur: 2.2, left: stretch('Left'), right: stretch('Right'), face: (t) => ({ Expr_Open: Math.sin(Math.min(1, t * 1.2) * Math.PI) * 0.8, Expr_Sleepy: 0.9, Expr_BrowsUp: Math.sin(t * Math.PI) * 0.4 }) },
    // rub the sleep out of the eyes (knuckles on the lower lids, eyes shut)
    ...both(
      { side: 'Left', contact: circles('underEyeL', 0.004, 2), effector: 'index', grip: 'point', dur: 0.9, gap: 0.006, face: closedEyes },
      { side: 'Right', contact: circles('underEyeR', 0.004, 2), effector: 'index', grip: 'point', dur: 0.9, gap: 0.006 },
    ),
  ],
  apply: (l) => void (l.care.morning = true),
  done: 'Good morning, sunshine.',
}

export const BONNET_OFF: StepDef = {
  id: 'bonnetOff',
  name: 'Take off the bonnet',
  blurb: 'Slip the satin bonnet off.',
  framing: 'hair',
  regions: ['hair'],
  products: PRODUCTS.fingers,
  mode: 'result',
  blocked: (l) => (l.hair.care.bonnet ? null : 'No bonnet on right now.'),
  moves: () => {
    const reachTop = (side: 'Left' | 'Right') => (t: number, ctx: MoveCtx) => {
      const s = side === 'Left' ? 1 : -1
      const head = ctx.c.head.getWorldPosition(new Vector3())
      const up = headUp(ctx.c)
      const out = new Vector3().crossVectors(up, new Vector3(0, 0, 1)).normalize().multiplyScalar(-s)
      return {
        target: head.clone().addScaledVector(up, 0.17 + 0.12 * ease(Math.max(0, t - 0.45) / 0.55)).addScaledVector(out, 0.1 - 0.04 * t),
        fingers: up.clone().addScaledVector(out, -0.6).normalize(),
        palm: out.clone().negate(),
        effector: 'palm' as const,
        grip: 'cup' as const,
        weight: Math.min(1, t * 3),
      }
    }
    return [{ dur: 1.8, left: reachTop('Left'), right: reachTop('Right') }]
  },
  apply: (l) => void (l.hair.care.bonnet = false),
  verify: (l) => !l.hair.care.bonnet,
  done: 'Bonnet off. Hello, hair!',
}

/* ------------------------------------------------------------------ A. patches */

export const PATCHES: StepDef = {
  id: 'patches',
  name: 'Remove pimple patches',
  blurb: 'Pinch the edge, peel it off slowly.',
  framing: 'face',
  regions: ['face'],
  products: PRODUCTS.fingers,
  mode: 'result',
  targets: (l) => l.care.patches.map((id) => ({ id, name: SPOT_NAME[id] })),
  blocked: (l) => (l.care.patches.length ? null : 'No patches left to peel.'),
  moves: ({ target }) => {
    const id = target as SpotId
    const holdTick = (_t: number, ctx: MoveCtx) => void (fx.skin.held = { id, p: effectorPoint(ctx.c.hands.Right, 'pinch') })
    const peelAway: Contact = (t, ctx) => {
      const r = spotEdge(id, 0.0055)(1, ctx)
      const side = new Vector3().crossVectors(r.n, headUp(ctx.c)).normalize()
      return { p: r.p.addScaledVector(r.n, 0.04 * ease(t)).addScaledVector(side, -0.025 * ease(t)), n: r.n }
    }
    return [
      ...stroke({ side: 'Right', contact: spotEdge(id, 0.0055), effector: 'pinch', grip: 'pinch', dur: 0.5, noOut: true, gap: 0.0015, tick: (t) => void (fx.skin.peel[id] = 0.15 * t) }),
      ...stroke({ side: 'Right', contact: peelAway, effector: 'pinch', grip: 'pinch', dur: 1.2, noIn: true, noOut: true, gap: 0.0015, tick: (t, ctx) => ((fx.skin.peel[id] = 0.15 + 0.82 * t), holdTick(t, ctx)), face: (t) => ({ Expr_Wince: Math.sin(t * Math.PI) * 0.35 }) }),
      // let go: the patch is off, the hand drops away
      ...stroke({ side: 'Right', contact: (_t, ctx) => peelAway(1, ctx), effector: 'pinch', grip: 'pinch', dur: 0.2, noIn: true, gap: 0.0015, tick: (t, ctx) => ((fx.skin.peel[id] = 0.97 + 0.03 * t), holdTick(t, ctx)) }),
    ]
  },
  apply: (l, { target }) => {
    const id = target as SpotId
    l.care.patches = l.care.patches.filter((p) => p !== id)
    // a night under a hydrocolloid patch: the spot has flattened into a flat, faint mark
    if (l.care.spots[id] === 'pimple' || l.care.spots[id] === 'treated') l.care.spots[id] = 'flat'
    if (!l.care.patches.length) markDone(l, 'patches')
  },
  verify: (l, { target }) => !l.care.patches.includes(target as SpotId),
  done: 'Patch off. That spot has gone flat.',
}

/* ------------------------------------------------------------------ A2. under-eye patches */

/** The outer corner of an under-eye patch, following it as it peels (0 = flat, 1 = off). */
const eyePatchCorner =
  (side: 'L' | 'R', peel: (t: number) => number): Contact =>
  (t, { c }) => {
    const key = `underEye${side}` as const
    const pts = c.care.strokes[key]
    const n = landmarkNormal(c, key)
    const mid = (pts?.length && landmark(c, `stroke:${key}:${pts.length >> 1}`)) || landmark(c, key) || c.head.getWorldPosition(new Vector3())
    const y = headUp(c)
    y.addScaledVector(n, -y.dot(n)).normalize()
    const out = new Vector3().crossVectors(y, n).normalize().multiplyScalar(side === 'R' ? -1 : 1)
    const hinge = mid.clone().addScaledVector(n, 0.0013).addScaledVector(y, 0.0015).addScaledVector(out, -0.016)
    const a = Math.min(1, peel(t) / 0.7) * 1.7
    return { p: hinge.addScaledVector(out, 0.033 * Math.cos(a)).addScaledVector(n, 0.033 * Math.sin(a) + 0.001), n }
  }

export const EYE_PATCHES: StepDef = {
  id: 'eyePatches',
  name: 'Peel off eye patches',
  blurb: 'Pinch each one at the outer corner and peel it slowly toward the nose.',
  framing: 'face',
  regions: ['face'],
  products: PRODUCTS.fingers,
  mode: 'result',
  blocked: (l) => (l.care.eyePatches ? null : 'No eye patches on right now.'),
  moves: () =>
    (['L', 'R'] as const).flatMap((s) => {
      const side = s === 'L' ? 'Left' : 'Right'
      return [
        // the hand on that side pinches the patch's outer corner...
        ...stroke({ side, contact: eyePatchCorner(s, () => 0), effector: 'pinch', grip: 'pinch', dur: 0.55, noOut: true, gap: 0.001, face: () => ({ Expr_Squint: 0.25 }) }),
        // ...and peels it off toward the nose (the hand follows the lifting edge)
        ...stroke({
          side,
          contact: eyePatchCorner(s, (t) => t),
          effector: 'pinch',
          grip: 'pinch',
          dur: 1.15,
          noIn: true,
          gap: 0.001,
          tick: (t) => ((fx.skin.eyePeel[s] = t > 0.97 ? 1 : t), void (t < 0.04 && sfx('peel'))),
          face: (t) => ({ Expr_Squint: 0.25, Expr_BrowsUp: Math.sin(t * Math.PI) * 0.25 }),
        }),
      ]
    }),
  apply: (l) => {
    l.care.eyePatches = false
    markDone(l, 'eyePatches')
  },
  verify: (l) => !l.care.eyePatches,
  done: 'Eye patches off: bright, de-puffed eyes.',
}

/* ------------------------------------------------------------------ B. pop (optional) */

const pimpleTargets = (l: StudioLook) =>
  (Object.entries(l.care.spots) as [SpotId, string][]).filter(([id, s]) => s === 'pimple' && !l.care.patches.includes(id)).map(([id]) => ({ id, name: SPOT_NAME[id] }))

export const POP: StepDef = {
  id: 'pop',
  name: 'Squeeze a spot',
  blurb: 'Optional and cartoony. Or put a patch on it instead.',
  note: 'Optional. A patch is the gentler choice.',
  framing: 'face',
  regions: ['face'],
  products: PRODUCTS.fingers,
  options: { label: 'How', list: [{ id: 'squeeze', name: 'Gentle squeeze' }, { id: 'patch', name: 'Patch it instead' }] },
  mode: 'result',
  targets: pimpleTargets,
  blocked: (l) => (pimpleTargets(l).length ? null : 'No raised spots to treat.'),
  moves: ({ target, option }) => {
    const id = target as SpotId
    if (option === 'patch') {
      return [
        ...stroke({ side: 'Right', contact: at(`spot:${id}`), effector: 'index', grip: 'point', dur: 0.8, gap: 0.0025, tick: (t) => void (fx.skin.peel[id] = 1 - t), prop: null }),
      ]
    }
    const press = (sign: number): Contact => (t, ctx) => spotEdge(id, 0.0075 - 0.0035 * ease(t), sign)(t, ctx)
    return [
      ...both(
        { side: 'Left', contact: press(1), effector: 'index', grip: 'point', dur: 1.3, gap: 0.0018, tilt: 0.7, tick: (t) => void (fx.skin.squeeze[id] = ease(t)), face: (t) => ({ Expr_Wince: 0.2 + 0.5 * t, Expr_Squint: 0.3 }) },
        { side: 'Right', contact: press(-1), effector: 'index', grip: 'point', dur: 1.3, gap: 0.0018, tilt: 0.7 },
      ),
      pause(0.5, (t) => void (t > 0 && t < 0.05 && (sfx('pop'), haptic(18))), (t) => ({ Expr_Wince: 0.7 * (1 - t) })),
    ]
  },
  apply: (l, { target, option }) => {
    const id = target as SpotId
    if (option === 'patch') {
      if (!l.care.patches.includes(id)) l.care.patches.push(id)
      return
    }
    l.care.spots[id] = 'popped'
    l.care.texture = clamp01(l.care.texture + 0.03)
    markDone(l, 'pop')
  },
  verify: (l, { target, option }) => (option === 'patch' ? l.care.patches.includes(target as SpotId) : l.care.spots[target as SpotId] === 'popped'),
  done: ({ option }) => (option === 'patch' ? 'Patched up. It’ll be calm by tonight.' : 'Done. Leave it alone now!'),
}

/* ------------------------------------------------------------------ C. cleanse */

const faceRub = (dur: number, eyesClosed = true): Move[] => [
  ...both(
    { side: 'Left', contact: circles('cheekL', 0.012, 2.5), effector: 'middle', grip: 'flat', dur, tilt: 0.25, tick: raise(['cheekL', 'perimeter'], 'foam', 0.95), face: eyesClosed ? closedEyes : undefined, noOut: true },
    { side: 'Right', contact: circles('cheekR', 0.012, 2.5), effector: 'middle', grip: 'flat', dur, tilt: 0.25, tick: raise(['cheekR', 'perimeter'], 'foam', 0.95), noOut: true },
  ),
  ...both(
    { side: 'Left', contact: glide(circles('cheekL', 0.012, 2.5), along('forehead', 1, 0.5)), effector: 'middle', grip: 'flat', dur: 0.6, noIn: true, noOut: true, face: eyesClosed ? closedEyes : undefined },
    { side: 'Right', contact: glide(circles('cheekR', 0.012, 2.5), along('forehead', 0, 0.5)), effector: 'middle', grip: 'flat', dur: 0.6, noIn: true, noOut: true },
  ),
  ...both(
    { side: 'Left', contact: along('forehead', 0.5, 1), effector: 'middle', grip: 'flat', dur: dur * 0.6, noIn: true, noOut: true, tick: raise('forehead', 'foam', 0.95), face: eyesClosed ? closedEyes : undefined },
    { side: 'Right', contact: along('forehead', 0.5, 0), effector: 'middle', grip: 'flat', dur: dur * 0.6, noIn: true, noOut: true },
  ),
  ...both(
    { side: 'Left', contact: glide(along('forehead', 0.5, 1), along('chin', 0.5, 1)), effector: 'middle', grip: 'flat', dur: 0.6, noIn: true, noOut: true, face: eyesClosed ? closedEyes : undefined },
    { side: 'Right', contact: glide(along('forehead', 0.5, 0), along('nose', 0, 1)), effector: 'index', grip: 'point', dur: 0.6, noIn: true, noOut: true },
  ),
  ...both(
    { side: 'Left', contact: along('chin', 1, 0.3), effector: 'middle', grip: 'flat', dur: dur * 0.5, noIn: true, tick: raise(['chin', 'nose'], 'foam', 0.95), face: eyesClosed ? closedEyes : undefined },
    { side: 'Right', contact: along('nose', 0, 1), effector: 'index', grip: 'point', dur: dur * 0.5, noIn: true },
  ),
]

export const CLEANSE: StepDef = {
  id: 'cleanse',
  name: 'Cleanse',
  blurb: 'Foam up over the forehead, cheeks, nose and chin, then rinse.',
  framing: 'face',
  regions: ['forehead', 'cheeks', 'nose', 'chin'],
  products: PRODUCTS.cleanser,
  options: { label: 'Remove with', list: [{ id: 'splash', name: 'Water splash' }, { id: 'cloth', name: 'Damp cloth' }] },
  mode: 'result',
  moves: ({ product, option }) => {
    const pad = product.id === 'micellar'
    if (pad) {
      return [
        { dur: 0.7, left: holdAt('Left', { across: 0.05 }), right: holdAt('Right', { across: -0.02, out: 0.27, grip: 'pinch' }), props: { Left: { id: 'toner', hold: 'grip', color: product.color }, Right: { id: 'pad', hold: 'pinch', load: 0 } } },
        { dur: 0.9, left: holding('Left', { across: 0.05, tilt: (t) => 0.6 * Math.sin(t * Math.PI) }), right: holding('Right', { across: -0.02, out: 0.27, grip: 'pinch' }), props: { Left: { id: 'toner', hold: 'grip', color: product.color }, Right: { id: 'pad', hold: 'pinch', load: 1 } } },
        ...wipe({ id: 'pad', hold: 'pinch', load: 1 }, 'wet', 0.6),
        pause(0.8, fade(['wet'], 0.6, 0)),
      ]
    }
    const rinse: Move[] =
      option === 'cloth'
        ? [...wipe({ id: 'towel', hold: 'palm' }, 'wet', 0.5, (t) => fade(['foam'], 1, 0)(t))]
        : [
            ...both(
              { side: 'Left', contact: at('cheekL'), effector: 'palm', grip: 'cup', dur: 1.6, tilt: -0.3, standoff: 0.14, face: closedEyes, tick: (t) => (fade(['foam'], 1, 0)(t), raise(['forehead', 'cheekL', 'cheekR', 'nose', 'chin', 'perimeter'], 'wet', 1)(Math.min(1, t * 2))) },
              { side: 'Right', contact: at('cheekR'), effector: 'palm', grip: 'cup', dur: 1.6, tilt: -0.3, standoff: 0.14 },
            ),
          ]
    return [
      ...dispense(product, 'cleanser'),
      ...faceRub(1.6),
      ...rinse,
      // pat dry with a towel
      ...stroke({ side: 'Right', contact: taps(circles('cheekR', 0.01, 0.5), 3), effector: 'palm', grip: 'flat', prop: { id: 'towel', hold: 'palm' }, dur: 0.9, tilt: 0, noOut: true, tick: fade(['wet', 'foam'], 1, 0.4) }),
      ...stroke({ side: 'Right', contact: glide(circles('cheekR', 0.01, 0.5), along('forehead', 0.3, 0.7)), effector: 'palm', grip: 'flat', prop: { id: 'towel', hold: 'palm' }, dur: 0.5, tilt: 0, noIn: true, noOut: true }),
      ...stroke({ side: 'Right', contact: taps(along('forehead', 0.3, 0.7), 2), effector: 'palm', grip: 'flat', prop: { id: 'towel', hold: 'palm' }, dur: 0.7, tilt: 0, noIn: true, tick: fade(['wet', 'foam'], 0.4, 0) }),
    ]
  },
  apply: (l) => {
    // Cleansing lifts last night's makeup and sunscreen too.
    l.makeup = structuredClone(DEFAULT_MAKEUP)
    l.care.dew = 0
    l.care.spf = false
    l.care.texture = clamp01(l.care.texture - 0.1)
    l.care.hydration = clamp01(l.care.hydration - 0.05)
    l.care.morning = false
    markDone(l, 'cleanse')
  },
  verify: (l) => l.care.done.includes('cleanse'),
  done: 'Fresh face unlocked.',
}

/** A pad/towel wipe over forehead, both cheeks, nose and chin. */
function wipe(prop: PropState & { id: 'pad' | 'towel'; hold: 'pinch' | 'palm' }, key: 'wet' | 'sheen', amount: number, extra?: (t: number) => void): Move[] {
  const palm = prop.hold === 'palm'
  const o = { side: 'Right' as const, prop, effector: palm ? ('palm' as const) : ('pinch' as const), grip: palm ? ('flat' as const) : ('pinch' as const), tilt: palm ? 0 : 0.15 }
  const tick = (regions: Region[]) => (t: number) => (raise(regions, key, amount)(t), extra?.(t))
  return [
    ...stroke({ ...o, contact: along('forehead', 0, 1), dur: 1.1, noOut: true, tick: tick(['forehead']) }),
    ...stroke({ ...o, contact: glide(along('forehead', 0, 1), circles('cheekL', 0.012, 1.5)), dur: 0.45, noIn: true, noOut: true }),
    ...stroke({ ...o, contact: circles('cheekL', 0.012, 1.5), dur: 0.9, noIn: true, noOut: true, tick: tick(['cheekL', 'perimeter']) }),
    ...stroke({ ...o, contact: glide(circles('cheekL', 0.012, 1.5), along('nose', 0, 1)), dur: 0.45, noIn: true, noOut: true }),
    ...stroke({ ...o, contact: along('nose', 0, 1), dur: 0.7, noIn: true, noOut: true, tick: tick(['nose']) }),
    ...stroke({ ...o, contact: glide(along('nose', 0, 1), circles('cheekR', 0.012, 1.5)), dur: 0.45, noIn: true, noOut: true }),
    ...stroke({ ...o, contact: circles('cheekR', 0.012, 1.5), dur: 0.9, noIn: true, noOut: true, tick: tick(['cheekR']) }),
    ...stroke({ ...o, contact: glide(circles('cheekR', 0.012, 1.5), along('chin', 0, 1)), dur: 0.45, noIn: true, noOut: true }),
    ...stroke({ ...o, contact: along('chin', 0, 1), dur: 0.7, noIn: true, tick: tick(['chin']) }),
  ]
}

/* ------------------------------------------------------------------ D. spot treatment */

const spotTargets = (l: StudioLook) =>
  (Object.entries(l.care.spots) as [SpotId, string][]).filter(([id, s]) => (s === 'pimple' || s === 'popped' || s === 'drained') && !l.care.patches.includes(id)).map(([id]) => ({ id, name: SPOT_NAME[id] }))

export const SPOT: StepDef = {
  id: 'spot',
  name: 'Spot treatment',
  blurb: 'A tiny dab right on the spot, left to sink in.',
  framing: 'face',
  regions: ['spots'],
  products: PRODUCTS.spot,
  mode: 'result',
  targets: spotTargets,
  blocked: (l) => (spotTargets(l).length ? null : 'No spots need treating.'),
  moves: ({ product, target }) => {
    const id = target as SpotId
    return [
      ...dispense(product, 'tube', 0.8),
      ...stroke({ side: 'Right', contact: taps(at(`spot:${id}`), 3, 0.006), effector: 'index', grip: 'point', prop: { id: 'dollop', hold: 'pinch', load: 0.5 }, dur: 1.0, gap: 0.0022, tick: (t) => void (fx.skin.dab[id] = ease(t)) }),
      // the product absorbs: a controlled fade of the dab, no hands
      pause(1.2, (t) => void (fx.skin.dab[id] = 1 - 0.75 * ease(t))),
    ]
  },
  apply: (l, { target }) => {
    l.care.spots[target as SpotId] = 'treated'
    markDone(l, 'spot')
  },
  verify: (l, { target }) => l.care.spots[target as SpotId] === 'treated',
  done: 'Treated. That spot is calming down.',
}

/* ------------------------------------------------------------------ E. toner */

export const TONER: StepDef = {
  id: 'toner',
  name: 'Toner',
  blurb: 'Soak a cotton pad, sweep it over the face.',
  framing: 'face',
  regions: ['forehead', 'cheeks', 'nose', 'chin'],
  products: PRODUCTS.toner,
  mode: 'result',
  moves: ({ product, look }) => {
    const bottle = { id: 'toner' as const, hold: 'grip' as const, color: product.color }
    const pad = { id: 'pad' as const, hold: 'pinch' as const, load: 0 }
    const wet: PropState & { id: 'pad'; hold: 'pinch' } = { id: 'pad', hold: 'pinch', load: 1, dirt: 0 }
    const dirt = padDirt(look)
    return [
      { dur: 0.7, left: holdAt('Left', { across: 0.05 }), right: holdAt('Right', { across: -0.03, out: 0.27, grip: 'pinch', up: -0.02 }), props: { Left: bottle, Right: pad } },
      {
        dur: 1.2,
        left: holding('Left', { across: 0.05, tilt: (t) => 0.9 * Math.sin(Math.min(1, t * 1.3) * Math.PI) }),
        right: holding('Right', { across: -0.03, out: 0.27, grip: 'pinch', up: -0.02 }),
        props: { Left: bottle, Right: pad },
        tick: (t) => void (pad.load = ease(Math.min(1, t * 1.4))),
      },
      ...wipe(wet, 'wet', 0.55, () => void (wet.dirt = Math.min(dirt, (wet.dirt ?? 0) + 0.006))),
      // hold the pad up: everything it lifted off the face, right there on the cotton
      { dur: 1.5, right: holdAt('Right', { across: -0.05, out: 0.3, up: 0.06, grip: 'pinch' }), props: { Right: wet }, tick: (t) => (fade(['wet'], 0.55, 0)(t), void (t < 0.05 && showResult({ kind: 'pad', dirt }))), face: () => ({ Expr_BrowsUp: 0.35 }) },
    ]
  },
  apply: (l, { product }) => {
    l.care.dew = clamp01(l.care.dew - 0.6)
    l.care.texture = clamp01(l.care.texture - (product.id === 'calm-toner' ? 0.14 : 0.08))
    l.care.glow = clamp01(l.care.glow + (product.id === 'glow-toner' ? 0.12 : 0.04))
    l.care.hydration = clamp01(l.care.hydration + 0.06)
    markDone(l, 'toner')
  },
  verify: (l) => l.care.done.includes('toner'),
  done: 'Toned and fresh.',
}

/* ------------------------------------------------------------------ F. serums */

export const SERUM: StepDef = {
  id: 'serum',
  name: 'Serum',
  blurb: 'A few drops from the dropper, pressed in.',
  framing: 'face',
  regions: ['forehead', 'cheeks'],
  products: PRODUCTS.serum,
  mode: 'result',
  moves: ({ product }) => {
    const dropper = { id: 'dropper' as const, hold: 'pinch' as const, load: 1, color: product.color }
    const eye = product.id === 'eye-wake'
    const drops = eye ? ['underEyeR', 'underEyeL'] : ['foreheadC', 'cheekL', 'cheekR']
    const moves: Move[] = []
    drops.forEach((key, i) => {
      const region: Region = key === 'foreheadC' ? 'forehead' : key === 'cheekL' ? 'cheekL' : 'cheekR'
      moves.push(
        ...stroke({
          side: 'Right',
          contact: at(key),
          prop: dropper,
          dur: 0.55,
          gap: 0.014,
          tilt: 0.9,
          noIn: i > 0,
          noOut: i < drops.length - 1,
          tick: (t) => {
            dropper.load = 1 - (i + t) / drops.length
            if (!eye) raise(region, 'sheen', 0.9)(t)
            else fx.skin.eyeCream = Math.max(fx.skin.eyeCream, 0.35 * t)
          },
          face: eye ? () => ({ Expr_Squint: 0.4 }) : undefined,
        }),
      )
    })
    // press it in with the fingertips
    moves.push(
      ...(eye
        ? stroke({ side: 'Right', contact: taps(along('underEyeR', 0, 1), 5), effector: 'middle', grip: 'tap', dur: 1.2, tick: (t) => void (fx.skin.eyeCream = 0.35 * (1 - t)) })
        : both(
            { side: 'Left', contact: circles('cheekL', 0.012, 2), effector: 'middle', grip: 'flat', dur: 1.3, tilt: 0.25, tick: raise(['cheekL', 'cheekR', 'forehead', 'nose', 'chin'], 'sheen', 0.75) },
            { side: 'Right', contact: circles('cheekR', 0.012, 2), effector: 'middle', grip: 'flat', dur: 1.3, tilt: 0.25 },
          )),
      pause(0.9, eye ? undefined : fade(['sheen'], 0.75, 0.3)),
    )
    return moves
  },
  apply: (l, { product }) => {
    const c = l.care
    if (product.id === 'hydra-drops') c.hydration = clamp01(c.hydration + 0.25)
    if (product.id === 'bright-10') c.texture = clamp01(c.texture - 0.15)
    if (product.id === 'glow-oil') {
      c.glow = clamp01(c.glow + 0.2)
      c.hydration = clamp01(c.hydration + 0.1)
    }
    if (product.id === 'eye-wake') c.underEye = clamp01(c.underEye - 0.15)
    if (product.id === 'spot-serum') for (const id of Object.keys(c.spots) as SpotId[]) if (c.spots[id] === 'pimple' || c.spots[id] === 'popped') c.spots[id] = 'treated'
    markDone(l, 'serum')
  },
  verify: (l) => l.care.done.includes('serum'),
  done: ({ product }) => `${product.name}: soaked right in.`,
}

/* ------------------------------------------------------------------ G. eye cream */

export const EYE_CREAM: StepDef = {
  id: 'eyeCream',
  name: 'Eye cream',
  blurb: 'Tiny taps under each eye with the ring finger.',
  framing: 'eyes',
  regions: ['underEyes'],
  products: PRODUCTS.eyeCream,
  mode: 'result',
  moves: ({ product }) => [
    ...dispense(product, 'jar', 0.7),
    ...stroke({ side: 'Right', contact: taps(along('underEyeR', 0.1, 0.9), 5, 0.006), effector: 'middle', grip: 'tap', prop: { id: 'dollop', hold: 'pinch', load: 0.6 }, dur: 1.3, gap: 0.0025, tilt: 0.55, tick: (t) => void (fx.skin.eyeCream = Math.max(fx.skin.eyeCream, Math.min(1, t * 2))), face: () => ({ Expr_Squint: 0.25 }) }),
    ...stroke({ side: 'Left', contact: taps(along('underEyeL', 0.1, 0.9), 5, 0.006), effector: 'middle', grip: 'tap', dur: 1.3, gap: 0.0025, tilt: 0.55, face: () => ({ Expr_Squint: 0.25 }) }),
    pause(1, (t) => void (fx.skin.eyeCream = 1 - ease(t))),
  ],
  apply: (l, { product }) => {
    l.care.underEye = clamp01(l.care.underEye - (product.id === 'cool-gel' ? 0.22 : 0.3))
    markDone(l, 'eyeCream')
  },
  verify: (l) => l.care.done.includes('eyeCream'),
  done: 'Bright eyes. Wide awake.',
}

/* ------------------------------------------------------------------ H. moisturiser / I. sunscreen */

const DOTS: [string, Region][] = [
  ['foreheadC', 'forehead'],
  ['cheekL', 'cheekL'],
  ['cheekR', 'cheekR'],
  ['noseTip', 'nose'],
  ['chin', 'chin'],
]

function dotAndBlend(product: Product, kind: 'jar' | 'sunscreen', extraNeck: boolean): Move[] {
  const dollop = { id: 'dollop' as const, hold: 'pinch' as const, load: 1 }
  const moves: Move[] = [...dispense(product, kind, 0.8)]
  DOTS.forEach(([key, region], i) =>
    moves.push(
      ...stroke({
        side: 'Right',
        contact: at(key),
        effector: 'index',
        grip: 'point',
        prop: dollop,
        dur: 0.32,
        inDur: i === 0 ? 0.6 : 0.35,
        gap: 0.0025,
        noIn: false,
        noOut: i < DOTS.length - 1,
        tick: (t) => ((fx.skin.cream[region] = Math.max(fx.skin.cream[region], 0.9 * t)), (dollop.load = 1 - (i + t) / DOTS.length)),
      }),
    ),
  )
  // blend with both hands: circles on the cheeks, then the forehead, nose and chin
  moves.push(
    ...both(
      { side: 'Left', contact: circles('cheekL', 0.014, 3), effector: 'middle', grip: 'flat', dur: 1.6, tilt: 0.2, noOut: true, tick: (t) => ((fx.skin.cream.cheekL = 0.9 * (1 - ease(t))), (fx.skin.cream.cheekR = 0.9 * (1 - ease(t))), raise(['cheekL', 'cheekR'], 'sheen', 0.55)(t)) },
      { side: 'Right', contact: circles('cheekR', 0.014, 3), effector: 'middle', grip: 'flat', dur: 1.6, tilt: 0.2, noOut: true },
    ),
    ...both(
      { side: 'Left', contact: glide(circles('cheekL', 0.014, 3), along('forehead', 1, 0.5)), effector: 'middle', grip: 'flat', dur: 0.5, noIn: true, noOut: true },
      { side: 'Right', contact: glide(circles('cheekR', 0.014, 3), along('forehead', 0, 0.5)), effector: 'middle', grip: 'flat', dur: 0.5, noIn: true, noOut: true },
    ),
    ...both(
      { side: 'Left', contact: along('forehead', 0.5, 1), effector: 'middle', grip: 'flat', dur: 0.9, noIn: true, tick: (t) => ((fx.skin.cream.forehead = 0.9 * (1 - ease(t))), raise('forehead', 'sheen', 0.55)(t)) },
      { side: 'Right', contact: along('forehead', 0.5, 0), effector: 'middle', grip: 'flat', dur: 0.9, noIn: true },
    ),
    ...stroke({ side: 'Right', contact: along('nose', 0, 1), effector: 'index', grip: 'point', dur: 0.6, noOut: true, tick: (t) => ((fx.skin.cream.nose = 0.9 * (1 - ease(t))), raise('nose', 'sheen', 0.55)(t)) }),
    ...stroke({ side: 'Right', contact: glide(along('nose', 0, 1), along('chin', 0, 1)), effector: 'index', grip: 'point', dur: 0.4, noIn: true, noOut: true }),
    ...stroke({ side: 'Right', contact: along('chin', 0, 1), effector: 'middle', grip: 'flat', dur: 0.7, noIn: true, noOut: !extraNeck, tick: (t) => ((fx.skin.cream.chin = 0.9 * (1 - ease(t))), raise('chin', 'sheen', 0.55)(t)) }),
  )
  if (extraNeck) {
    moves.push(
      ...stroke({ side: 'Right', contact: glide(along('chin', 0, 1), at('neck')), effector: 'palm', grip: 'flat', dur: 0.4, noIn: true, noOut: true }),
      ...stroke({ side: 'Right', contact: circles('neck', 0.02, 1.5), effector: 'palm', grip: 'flat', dur: 1.0, noIn: true, tilt: -0.2, tick: raise('perimeter', 'sheen', 0.4) }),
      ...both(
        { side: 'Left', contact: at('earL'), effector: 'index', grip: 'pinch', dur: 0.8, tilt: 0.3 },
        { side: 'Right', contact: at('earR'), effector: 'index', grip: 'pinch', dur: 0.8, tilt: 0.3 },
      ),
    )
  }
  moves.push(pause(0.6, fade(['sheen'], 0.55, 0.25)))
  return moves
}

export const MOISTURISER: StepDef = {
  id: 'moisturiser',
  name: 'Moisturiser',
  blurb: 'Dot it on, then blend in gentle circles.',
  framing: 'face',
  regions: ['forehead', 'cheeks', 'nose', 'chin', 'neck'],
  products: PRODUCTS.moisturiser,
  mode: 'result',
  moves: ({ product }) => dotAndBlend(product, 'jar', true),
  apply: (l, { product }) => {
    l.care.hydration = clamp01(l.care.hydration + (product.id === 'butter-cream' ? 0.45 : 0.35))
    l.care.glow = clamp01(l.care.glow + 0.08)
    l.care.texture = clamp01(l.care.texture - 0.05)
    markDone(l, 'moisturiser')
  },
  verify: (l) => l.care.done.includes('moisturiser'),
  done: 'Hydrated and happy skin.',
}

export const SUNSCREEN: StepDef = {
  id: 'sunscreen',
  name: 'Sunscreen',
  blurb: 'Face, ears and neck, blended all the way in.',
  framing: 'face',
  regions: ['face', 'ears', 'neck'],
  products: PRODUCTS.sunscreen,
  mode: 'result',
  moves: ({ product }) => dotAndBlend(product, 'sunscreen', true),
  apply: (l) => {
    l.care.spf = true
    l.care.glow = clamp01(l.care.glow + 0.15)
    markDone(l, 'sunscreen')
    showResult({ kind: 'glow' })
  },
  verify: (l) => l.care.spf,
  done: 'Protected. Go shine.',
}

/* ------------------------------------------------------------------ J. lips */

export const LIP_BALM: StepDef = {
  id: 'lipBalm',
  name: 'Lip care',
  blurb: 'Two smooth swipes of balm.',
  framing: 'lips',
  regions: ['lips'],
  products: PRODUCTS.balm,
  mode: 'result',
  moves: ({ product }) => [
    ...stroke({ side: 'Right', contact: along('lips', 0, 1), prop: { id: 'balm', hold: 'pinch', color: product.color }, dur: 0.9, gap: 0.0015, noOut: true, tick: (t) => void (fx.skin.balm = 0.6 * t), face: () => ({ Expr_Pout: 0.35 }) }),
    ...stroke({ side: 'Right', contact: along('lips', 1, 0), prop: { id: 'balm', hold: 'pinch', color: product.color }, dur: 0.9, gap: 0.0015, noIn: true, tick: (t) => void (fx.skin.balm = 0.6 + 0.4 * t), face: () => ({ Expr_Pout: 0.35 }) }),
    pause(0.6, (t) => void (fx.skin.balm = 1 - t * 0.3), (t) => ({ Expr_Pout: 0.35 * (1 - t), Expr_Smile: 0.3 * t })),
  ],
  apply: (l, { product }) => {
    l.care.lips = 1
    if (product.id === 'tinted-balm') l.makeup.lipstick = { color: '#9A3A4A', amount: Math.max(l.makeup.lipstick.amount, 0.3) }
    if (product.id === 'gloss-balm') l.makeup.gloss = Math.max(l.makeup.gloss, 0.8)
    markDone(l, 'lipBalm')
  },
  verify: (l) => l.care.lips >= 1,
  done: 'Soft, smooth lips.',
}

/** The routine in order. */
export const SKINCARE_STEPS: StepDef[] = [PATCHES, POP, CLEANSE, SPOT, TONER, SERUM, EYE_CREAM, MOISTURISER, SUNSCREEN, LIP_BALM]

/* ------------------------------------------------------------------ Skincare Bay: conditions */

/** How much a cotton pad lifts off this face: makeup, sunscreen and an unwashed face all show. */
export function padDirt(l: StudioLook) {
  const m = l.makeup
  const makeup = m.foundation.amount + m.concealer.amount * 0.5 + m.powder.amount * 0.5 + m.blush.amount * 0.3 + m.contour.amount * 0.3 + m.bronzer.amount * 0.3
  const washed = l.care.done.includes('cleanse') || l.care.done.includes('wash')
  return clamp01(0.22 + makeup * 0.35 + (l.care.spf ? 0.2 : 0) + (washed ? -0.12 : 0.28) + l.care.dry * 0.1)
}

const SPOT_POOL: SpotId[] = ['cheekL', 'forehead1', 'chin', 'cheekR', 'nose', 'forehead2', 'jawR', 'cheekL2']

/** Anything left to treat? */
export function hasConditions(c: SkinCare) {
  return Object.values(c.spots).some((s) => s === 'pimple' || s === 'boil' || s === 'popped' || s === 'drained') || c.rash > 0.05 || c.pigment > 0.05 || c.dry > 0.05 || c.patches.length > 0
}

/**
 * A new day at Skincare Bay: the doll arrives with her own realistic mix of skin issues (raised
 * spots, sometimes a boil, a rash, dark marks, dry flaky patches, tired under-eyes), different per
 * doll and per visit, at least three of them. Only when her skin is clear: anything still being
 * treated stays as it is, and every result persists on the doll.
 */
export function skinCheckIn(l: StudioLook, seed: number) {
  let a = seed >>> 0 || 7
  const r = () => {
    a = (a * 1664525 + 1013904223) >>> 0
    return a / 4294967296
  }
  const issues = ['pimples', 'boil', 'rash', 'pigment', 'dry', 'underEye'] as const
  const chosen = new Set<(typeof issues)[number]>()
  while (chosen.size < 3 + Math.floor(r() * 2)) chosen.add(issues[Math.floor(r() * issues.length)])
  const c: SkinCare = { ...structuredClone(CLEAR_SKIN), spots: {}, patches: [], hydration: 0.3 + r() * 0.2, glow: 0.15, lips: 0.3, texture: 0.25 + r() * 0.3 }
  const pool = [...SPOT_POOL].sort(() => r() - 0.5)
  if (chosen.has('pimples')) for (const id of pool.splice(0, 2 + Math.floor(r() * 3))) c.spots[id] = 'pimple'
  if (chosen.has('boil')) c.spots[pool.splice(0, 1)[0]] = 'boil'
  if (chosen.has('rash')) c.rash = 0.45 + r() * 0.45
  if (chosen.has('pigment')) c.pigment = 0.4 + r() * 0.5
  if (chosen.has('dry')) c.dry = 0.45 + r() * 0.45
  c.underEye = chosen.has('underEye') ? 0.55 + r() * 0.3 : 0.15
  l.care = c
}

/* ------------------------------------------------------------------ face wash (dewy result) */

/**
 * Lathering between the palms: the hands meet in front of her chest, palms together, fingers up
 * and a little forward, and rub up and down against each other (the cleanser foams up).
 */
const lather = (dur: number): Move => {
  const hand = (side: 'Left' | 'Right') => (t: number, { c }: MoveCtx): HandGoal => {
    const s = side === 'Left' ? 1 : -1
    const neck = landmark(c, 'neck') ?? c.head.getWorldPosition(new Vector3())
    const rub = Math.sin(t * Math.PI * 7) * 0.014 * s
    return {
      target: neck.clone().add(localVec(c, new Vector3(0.017 * s, -0.17 + rub, 0.23))),
      fingers: localDir(c, new Vector3(-0.12 * s, 0.85, 0.5)).normalize(),
      palm: localDir(c, new Vector3(-s, 0, 0)),
      effector: 'palm',
      grip: 'flat',
      weight: Math.min(1, t * 5 + 0.001),
    }
  }
  return { dur, left: hand('Left'), right: hand('Right') }
}

/** One splash of water: cupped palms to the cheeks (eyes shut), a splash sound and droplets. */
const splash = (k: number, of: number, rinse: boolean): Move[] =>
  both(
    {
      side: 'Left',
      contact: at('cheekL'),
      effector: 'palm',
      grip: 'cup',
      dur: 0.7,
      tilt: -0.3,
      standoff: 0.14,
      face: closedEyes,
      tick: (t) => (rinse && fade(['foam'], 1 - k / of, 1 - (k + 1) / of)(t), raise(['forehead', 'cheekL', 'cheekR', 'nose', 'chin', 'perimeter'], 'wet', 1)(t), void (fx.skin.dew = Math.max(fx.skin.dew, rinse ? ((k + t) / of) * 0.9 : 0.3 * t)), void (t > 0.45 && t < 0.5 && (sfx('splash'), haptic(10)))),
    },
    { side: 'Right', contact: at('cheekR'), effector: 'palm', grip: 'cup', dur: 0.7, tilt: -0.3, standoff: 0.14 },
  )

/** Patting dry with a soft towel: pressed (never rubbed) to each cheek, the forehead and chin. */
const patDry = (): Move[] => {
  const towel: PropState = { id: 'towel', hold: 'palm' }
  return [
    ...stroke({ side: 'Right', contact: taps(at('cheekR'), 2, 0.012), effector: 'palm', grip: 'flat', dur: 0.8, prop: towel, noOut: true, tick: (t) => (fade(['wet'], 1, 0.75)(t), void (Math.abs(t - 0.25) < 0.02 || Math.abs(t - 0.75) < 0.02 ? sfx('pat') : 0)), face: closedEyes }),
    ...stroke({ side: 'Right', contact: glide(at('cheekR'), at('cheekL')), effector: 'palm', grip: 'flat', dur: 0.5, prop: towel, noIn: true, noOut: true, standoff: 0.03, face: closedEyes }),
    ...stroke({ side: 'Right', contact: taps(at('cheekL'), 2, 0.012), effector: 'palm', grip: 'flat', dur: 0.8, prop: towel, noIn: true, noOut: true, tick: (t) => (fade(['wet'], 0.75, 0.5)(t), void (Math.abs(t - 0.25) < 0.02 || Math.abs(t - 0.75) < 0.02 ? sfx('pat') : 0)), face: closedEyes }),
    ...stroke({ side: 'Right', contact: taps(along('forehead', 0.5, 0.5), 2, 0.012), effector: 'palm', grip: 'flat', dur: 0.8, prop: towel, noIn: true, tick: (t) => (fade(['wet'], 0.5, 0.2)(t), void (Math.abs(t - 0.5) < 0.02 ? sfx('pat') : 0)), face: closedEyes }),
  ]
}

export const FACE_WASH: StepDef = {
  id: 'wash',
  name: 'Face wash',
  blurb: 'Wet the face, lather the cleanser between your palms, massage it in, rinse three times, pat dry.',
  framing: 'face',
  regions: ['forehead', 'cheeks', 'nose', 'chin'],
  products: PRODUCTS.cleanser.slice(0, 2),
  mode: 'result',
  moves: ({ product }) => [
    // warm water first, so the cleanser foams
    ...splash(0, 1, false),
    ...dispense(product, 'cleanser'),
    // work it into a rich lather between the palms
    lather(1.5),
    // massage the foam in: cheeks, forehead, down the nose, round the chin (eyes shut)
    ...faceRub(2.2),
    // three splashes of water: cupped hands to the face, foam rinses away, droplets bead up
    ...[0, 1, 2].flatMap((k) =>
      both(
        { side: 'Left', contact: at('cheekL'), effector: 'palm', grip: 'cup', dur: 0.7, tilt: -0.3, standoff: 0.14, face: closedEyes, tick: (t) => (fade(['foam'], 1 - k / 3, 1 - (k + 1) / 3)(t), raise(['forehead', 'cheekL', 'cheekR', 'nose', 'chin', 'perimeter'], 'wet', 1)(t), void (fx.skin.dew = Math.max(fx.skin.dew, ((k + t) / 3) * 0.9)), void (t > 0.45 && t < 0.5 && (sfx('splash'), haptic(10)))) },
        { side: 'Right', contact: at('cheekR'), effector: 'palm', grip: 'cup', dur: 0.7, tilt: -0.3, standoff: 0.14 },
      ),
    ),
    // pat dry with a towel (dewy skin stays)
    ...patDry(),
    pause(0.9, (t) => void (fx.skin.dew = 0.9 + 0.1 * t), () => ({ Expr_BlinkL: 0.3, Expr_BlinkR: 0.3, Expr_Smile: 0.35 })),
  ],
  apply: (l) => {
    l.makeup = structuredClone(DEFAULT_MAKEUP)
    l.care.spf = false
    l.care.dew = 1
    l.care.texture = clamp01(l.care.texture - 0.12)
    l.care.dry = clamp01(l.care.dry - 0.05)
    l.care.morning = false
    markDone(l, 'wash')
    showResult({ kind: 'dew' })
  },
  verify: (l) => l.care.dew > 0.9,
  done: 'Squeaky clean: wet, dewy and fresh.',
}

/* ------------------------------------------------------------------ exfoliate (dry, flaky) */

export const EXFOLIATE: StepDef = {
  id: 'exfoliate',
  name: 'Scrub away flakes',
  blurb: 'Tiny circles of gentle scrub over the dry patches.',
  framing: 'face',
  regions: ['forehead', 'nose', 'chin', 'cheeks'],
  products: PRODUCTS.scrub,
  mode: 'result',
  blocked: (l) => (l.care.dry > 0.05 ? null : 'No dry, flaky patches right now.'),
  moves: ({ product }) => [
    ...dispense(product, 'jar', 0.8),
    ...both(
      { side: 'Left', contact: circles('cheekL', 0.01, 4), effector: 'middle', grip: 'flat', dur: 1.8, tilt: 0.25, noOut: true, tick: (t) => ((fx.skin.flakesOff = 0.5 * t), raise(['cheekL', 'cheekR'], 'cream', 0.55)(Math.min(1, t * 3))) },
      { side: 'Right', contact: circles('cheekR', 0.01, 4), effector: 'middle', grip: 'flat', dur: 1.8, tilt: 0.25, noOut: true },
    ),
    ...stroke({ side: 'Right', contact: circles('foreheadC', 0.012, 3), effector: 'middle', grip: 'flat', dur: 1.2, noIn: false, noOut: true, tick: (t) => ((fx.skin.flakesOff = 0.5 + 0.3 * t), raise('forehead', 'cream', 0.55)(Math.min(1, t * 3))) }),
    ...stroke({ side: 'Right', contact: circles('chin', 0.009, 3), effector: 'middle', grip: 'flat', dur: 1.0, noIn: true, tick: (t) => ((fx.skin.flakesOff = 0.8 + 0.2 * t), raise(['chin', 'nose'], 'cream', 0.55)(Math.min(1, t * 3))) }),
    // rinse
    ...both(
      { side: 'Left', contact: at('cheekL'), effector: 'palm', grip: 'cup', dur: 1.1, tilt: -0.3, standoff: 0.14, face: closedEyes, tick: (t) => (fade(['cream'], 0.55, 0)(t), raise(['forehead', 'cheekL', 'cheekR', 'nose', 'chin'], 'wet', 0.8)(t)) },
      { side: 'Right', contact: at('cheekR'), effector: 'palm', grip: 'cup', dur: 1.1, tilt: -0.3, standoff: 0.14 },
    ),
    pause(0.6, fade(['wet'], 0.8, 0.3)),
  ],
  apply: (l) => {
    l.care.dry = clamp01(l.care.dry * 0.3 - 0.05)
    l.care.texture = clamp01(l.care.texture - 0.12)
    markDone(l, 'exfoliate')
    showResult({ kind: 'smooth' })
  },
  verify: (l) => l.care.done.includes('exfoliate'),
  done: 'Flakes gone. Seal it in with moisturiser.',
}

/* ------------------------------------------------------------------ soothe (rash) */

export const SOOTHE: StepDef = {
  id: 'soothe',
  name: 'Calm the rash',
  blurb: 'Cool aloe gel, patted on and left to soothe.',
  framing: 'face',
  regions: ['cheeks', 'chin'],
  products: PRODUCTS.soothe,
  mode: 'result',
  blocked: (l) => (l.care.rash > 0.05 ? null : 'No rash to calm right now.'),
  moves: ({ product }) => [
    ...dispense(product, 'jar', 0.7),
    ...both(
      { side: 'Left', contact: taps(circles('cheekL', 0.012, 1), 6, 0.006), effector: 'middle', grip: 'tap', dur: 1.5, tilt: 0.4, noOut: true, tick: (t) => ((fx.skin.soothe = ease(t) * 0.7), raise(['cheekL', 'cheekR'], 'sheen', 0.8)(t), void (Math.floor(t * 6) !== Math.floor((t - 0.02) * 6) && sfx('pat'))) },
      { side: 'Right', contact: taps(circles('cheekR', 0.012, 1), 6, 0.006), effector: 'middle', grip: 'tap', dur: 1.5, tilt: 0.4, noOut: true },
    ),
    ...stroke({ side: 'Right', contact: taps(at('chin'), 4, 0.006), effector: 'middle', grip: 'tap', dur: 0.9, noIn: true, tick: (t) => ((fx.skin.soothe = 0.7 + 0.3 * t), raise('chin', 'sheen', 0.8)(t)) }),
    pause(1.2, () => void (fx.skin.soothe = 1), () => ({ Expr_Smile: 0.25, Expr_Sleepy: 0.2 })),
  ],
  apply: (l) => {
    l.care.rash = clamp01(l.care.rash * 0.35 - 0.05)
    l.care.texture = clamp01(l.care.texture - 0.08)
    markDone(l, 'soothe')
    showResult({ kind: 'calm' })
  },
  verify: (l) => l.care.done.includes('soothe'),
  done: 'Redness calmed right down.',
}

/* ------------------------------------------------------------------ brighten (hyperpigmentation) */

export const BRIGHTEN: StepDef = {
  id: 'brighten',
  name: 'Fade dark marks',
  blurb: 'Brightening serum dropped on and pressed in.',
  framing: 'face',
  regions: ['forehead', 'cheeks'],
  products: PRODUCTS.brighten,
  mode: 'result',
  blocked: (l) => (l.care.pigment > 0.05 ? null : 'No dark marks to fade right now.'),
  moves: ({ product }) => {
    const dropper = { id: 'dropper' as const, hold: 'pinch' as const, load: 1, color: product.color }
    const drops = ['cheekL', 'cheekR', 'foreheadC']
    const moves: Move[] = []
    drops.forEach((key, i) =>
      moves.push(
        ...stroke({
          side: 'Right',
          contact: at(key),
          prop: dropper,
          dur: 0.55,
          gap: 0.014,
          tilt: 0.9,
          noIn: i > 0,
          noOut: i < drops.length - 1,
          tick: (t) => ((dropper.load = 1 - (i + t) / drops.length), raise(key === 'foreheadC' ? 'forehead' : (key as Region), 'sheen', 0.9)(t), void (t > 0.5 && t < 0.53 && sfx('drip'))),
        }),
      ),
    )
    moves.push(
      ...both(
        { side: 'Left', contact: taps(circles('cheekL', 0.012, 1), 5, 0.006), effector: 'palm', grip: 'flat', dur: 1.4, tilt: 0.2, tick: (t) => ((fx.skin.bright = ease(t)), raise(['cheekL', 'cheekR', 'forehead'], 'sheen', 0.7)(t)) },
        { side: 'Right', contact: taps(circles('cheekR', 0.012, 1), 5, 0.006), effector: 'palm', grip: 'flat', dur: 1.4, tilt: 0.2 },
      ),
      pause(0.8, fade(['sheen'], 0.7, 0.3)),
    )
    return moves
  },
  apply: (l) => {
    l.care.pigment = clamp01(l.care.pigment - 0.45)
    l.care.glow = clamp01(l.care.glow + 0.08)
    markDone(l, 'brighten')
    showResult({ kind: 'bright' })
  },
  verify: (l) => l.care.done.includes('brighten'),
  done: 'Dark marks visibly lighter. Again tomorrow for more.',
}

/* ------------------------------------------------------------------ boils: warm compress */

const boilTargets = (l: StudioLook) => (Object.entries(l.care.spots) as [SpotId, string][]).filter(([, s]) => s === 'boil').map(([id]) => ({ id, name: SPOT_NAME[id] }))

export const COMPRESS: StepDef = {
  id: 'compress',
  name: 'Warm compress',
  blurb: 'Hold a warm cloth on the boil until it comes to a head and drains.',
  note: 'Never squeeze a boil.',
  framing: 'face',
  regions: ['spots'],
  products: PRODUCTS.compress,
  mode: 'result',
  targets: boilTargets,
  blocked: (l) => (boilTargets(l).length ? null : 'No boils to treat.'),
  moves: ({ target }) => {
    const id = target as SpotId
    return [
      ...stroke({ side: 'Right', contact: at(`spot:${id}`), effector: 'palm', grip: 'flat', prop: { id: 'towel', hold: 'palm' }, dur: 2.6, gap: 0.004, tilt: 0, face: (t) => ({ Expr_Wince: 0.3 * (1 - t), Expr_Sleepy: 0.3 * t }), tick: (t) => void (fx.skin.squeeze[id] = 0.4 * t) }),
      pause(0.8, (t) => void (fx.skin.heal[id] = 0.2 * t)),
    ]
  },
  apply: (l, { target }) => {
    l.care.spots[target as SpotId] = 'drained'
    markDone(l, 'compress')
    showResult({ kind: 'heal' })
  },
  verify: (l, { target }) => l.care.spots[target as SpotId] === 'drained',
  done: 'It came to a head and drained. Now let it heal: a dab of spot gel helps.',
}

/** Pimple patch on: tap a patch onto a raised spot (it comes off later as a flat spot). */
export const PATCH_ON: StepDef = {
  ...POP,
  id: 'patchOn',
  name: 'Pimple patch',
  blurb: 'Press a clear patch onto a raised spot.',
  options: undefined,
  note: undefined,
  moves: (ctx) => POP.moves({ ...ctx, option: 'patch' }),
  apply: (l, ctx) => POP.apply(l, { ...ctx, option: 'patch' }),
  verify: (l, ctx) => l.care.patches.includes(ctx.target as SpotId),
  done: 'Patched. Peel it off when you’re ready.',
}

