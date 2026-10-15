import { Vector3 } from 'three'
import { DEFAULT_MAKEUP, type Finish, type Layer, type LipFinish, type Makeup, type StudioLook } from '../../shared/studio/look'
import { MAKEUP_PRESETS } from '../../shared/studio/presets'
import type { PropId, PropState } from '../character/props'
import type { Side } from '../character/rig'
import { fx } from '../state/fx'
import { headUp, localDir, type Character, type Move, type MoveCtx } from './engine'
import { along, at, both, circles, glide, holdAt, stroke, taps, type Contact } from './moves'
import type { Product, StepCtx, StepDef } from './steps'

/**
 * Makeup application: each product is its own step with a shade, a finish where it applies, an
 * applicator and an animation over the right part of the face. The final look is previewed while
 * the animation reveals the layer (fx.makeup.reveal), so the face changes stroke by stroke; Undo,
 * Remove and every other layer stay independent.
 */

export type MakeupKey = Exclude<keyof Makeup, 'foundationFinish' | 'lipFinish' | 'gloss'> | 'gloss'

const ease = (t: number) => t * t * (3 - 2 * t)
const reveal = (key: string, from = 0, to = 1) => (t: number) => void (fx.makeup.reveal[key] = from + (to - from) * ease(t))

/** Offsets from the under-eye landmark: lid, lash line, brow. */
const upBy = (d: number, out = 0.002, sideways = 0) => (c: Character) => {
  const up = headUp(c)
  const fwd = localDir(c, new Vector3(0, 0, 1))
  const side = localDir(c, new Vector3(1, 0, 0))
  return up.multiplyScalar(d).addScaledVector(fwd, out).addScaledVector(side, sideways)
}

const eyeLine = (s: 'L' | 'R', lift: number, from: number, to: number, out = 0.002): Contact => {
  const sign = s === 'L' ? 1 : -1
  return (t, ctx) => at(`underEye${s}`, upBy(lift, out, sign * (from + (to - from) * t)))(t, ctx)
}


/* ------------------------------------------------------------------ applicators */

export const APPLICATORS: Record<string, { id: string; name: string; prop: PropId | null }[]> = {
  primer: [{ id: 'fingers', name: 'Fingertips', prop: null }],
  corrector: [{ id: 'brush', name: 'Small brush', prop: 'brush' }, { id: 'fingers', name: 'Ring finger', prop: null }],
  foundation: [{ id: 'sponge', name: 'Beauty sponge', prop: 'sponge' }, { id: 'brush', name: 'Buffing brush', prop: 'kabuki' }, { id: 'fingers', name: 'Fingertips', prop: null }],
  concealer: [{ id: 'sponge', name: 'Beauty sponge', prop: 'sponge' }, { id: 'brush', name: 'Small brush', prop: 'brush' }, { id: 'fingers', name: 'Ring finger', prop: null }],
  powder: [{ id: 'puff', name: 'Powder puff', prop: 'puff' }, { id: 'kabuki', name: 'Kabuki brush', prop: 'kabuki' }],
  contour: [{ id: 'brush', name: 'Angled brush', prop: 'brush' }],
  bronzer: [{ id: 'kabuki', name: 'Kabuki brush', prop: 'kabuki' }],
  blush: [{ id: 'brush', name: 'Blush brush', prop: 'brush' }, { id: 'fingers', name: 'Fingertips (cream)', prop: null }],
  highlight: [{ id: 'fan', name: 'Fan brush', prop: 'fanBrush' }, { id: 'fingers', name: 'Fingertip', prop: null }],
  setting: [{ id: 'spray', name: 'Spray', prop: 'spray' }],
  eyeshadow: [{ id: 'brush', name: 'Shadow brush', prop: 'brush' }, { id: 'fingers', name: 'Fingertip', prop: null }],
  innerCorner: [{ id: 'brush', name: 'Detail brush', prop: 'brush' }],
  liner: [{ id: 'pencil', name: 'Liner pencil', prop: 'pencil' }],
  lowerLiner: [{ id: 'pencil', name: 'Kohl pencil', prop: 'pencil' }],
  mascara: [{ id: 'wand', name: 'Mascara wand', prop: 'mascara' }],
  lipLiner: [{ id: 'pencil', name: 'Lip pencil', prop: 'pencil' }],
  lipstick: [{ id: 'bullet', name: 'Lipstick', prop: 'lipstick' }],
  lipCentre: [{ id: 'wand', name: 'Doe-foot wand', prop: 'gloss' }],
  gloss: [{ id: 'wand', name: 'Gloss wand', prop: 'gloss' }],
}

/* ------------------------------------------------------------------ animations per product */

type Anim = (key: string, prop: PropState | null, ctx: StepCtx) => Move[]

const brushOn = (side: Side, contact: Contact, prop: PropState | null, key: string, dur: number, opts: Partial<Parameters<typeof stroke>[0]> = {}) =>
  stroke({ side, contact, prop, dur, effector: prop ? 'pinch' : 'middle', grip: prop ? 'pinch' : 'flat', tick: reveal(key), ...opts })

/** Both cheeks, one hand each, the reveal shared. */
const cheeks = (key: string, prop: PropState | null, contactL: Contact, contactR: Contact, dur: number): Move[] => [
  ...brushOn('Right', contactR, prop, key, dur, { tick: reveal(key, 0, 0.55) }),
  ...brushOn('Left', contactL, prop, key, dur, { tick: reveal(key, 0.55, 1) }),
]

const faceBase: Anim = (key, prop, { option }) => {
  const sponge = option === 'sponge'
  const work = (c: Contact) => (sponge ? taps(c, 6, 0.007) : c)
  const r = (from: number, to: number) => reveal(key, from, to)
  return [
    ...brushOn('Right', work(circles('cheekR', 0.012, 2)), prop, key, 1.0, { noOut: true, tick: r(0, 0.25), tilt: 0.6 }),
    ...brushOn('Right', glide(circles('cheekR', 0.012, 2), along('forehead', 0, 1)), prop, key, 0.4, { noIn: true, noOut: true, tick: undefined }),
    ...brushOn('Right', work(along('forehead', 0, 1)), prop, key, 1.0, { noIn: true, noOut: true, tick: r(0.25, 0.5) }),
    ...brushOn('Right', glide(along('forehead', 0, 1), circles('cheekL', 0.012, 2)), prop, key, 0.4, { noIn: true, noOut: true, tick: undefined }),
    ...brushOn('Right', work(circles('cheekL', 0.012, 2)), prop, key, 1.0, { noIn: true, noOut: true, tick: r(0.5, 0.75) }),
    ...brushOn('Right', glide(circles('cheekL', 0.012, 2), along('nose', 0, 1)), prop, key, 0.4, { noIn: true, noOut: true, tick: undefined }),
    ...brushOn('Right', work(along('nose', 0, 1)), prop, key, 0.6, { noIn: true, noOut: true, tick: r(0.75, 0.88) }),
    ...brushOn('Right', glide(along('nose', 0, 1), along('chin', 0, 1)), prop, key, 0.35, { noIn: true, noOut: true, tick: undefined }),
    ...brushOn('Right', work(along('chin', 0, 1)), prop, key, 0.7, { noIn: true, tick: r(0.88, 1) }),
  ]
}

const underEyes: Anim = (key, prop) => [
  ...brushOn('Right', taps(along('underEyeR', 0.1, 0.9), 4, 0.005), prop, key, 1.0, { tick: reveal(key, 0, 0.5), gap: 0.003, tilt: 0.6 }),
  ...brushOn('Left', taps(along('underEyeL', 0.1, 0.9), 4, 0.005), prop, key, 1.0, { tick: reveal(key, 0.5, 1), gap: 0.003, tilt: 0.6 }),
]

/** Cheek hollow: from in front of the ear toward the mouth corner, under the cheekbone. */
const hollow =
  (s: 'L' | 'R'): Contact =>
  (t, ctx) => {
    const a = at(`ear${s}`)(t, ctx)
    const b = at(`lipCorner${s}`)(t, ctx)
    const cheek = at(`cheek${s}`)(t, ctx)
    const p = a.p.clone().lerp(b.p, 0.15 + 0.4 * t).lerp(cheek.p, 0.35)
    return { p: p.addScaledVector(headUp(ctx.c), -0.008), n: cheek.n.clone().lerp(a.n, 0.3 * (1 - t)).normalize() }
  }

/** Temple → cheek → jaw ("3" shape) on one side. */
const three =
  (s: 'L' | 'R'): Contact =>
  (t, ctx) => {
    const keys = [`temple${s}`, `cheek${s}`, `jaw${s}`]
    const f = t * 2
    const i = Math.min(1, Math.floor(f))
    const a = at(keys[i])(t, ctx)
    const b = at(keys[i + 1])(t, ctx)
    return { p: a.p.lerp(b.p, f - i), n: a.n.lerp(b.n, f - i).normalize() }
  }

const cheekbone =
  (s: 'L' | 'R'): Contact =>
  (t, ctx) => {
    const c = at(`cheek${s}`)(t, ctx)
    const e = at(`temple${s}`)(t, ctx)
    return { p: c.p.clone().lerp(e.p, 0.15 + 0.35 * t).addScaledVector(headUp(ctx.c), 0.012), n: c.n.lerp(e.n, 0.3).normalize() }
  }

const eyesClosed = () => ({ Expr_BlinkL: 1, Expr_BlinkR: 1 })

const ANIMS: Record<string, Anim> = {
  primer: (key, prop) => [
    ...both(
      { side: 'Left', contact: circles('cheekL', 0.014, 2), effector: 'middle', grip: 'flat', dur: 1.2, tick: reveal(key), tilt: 0.25 },
      { side: 'Right', contact: circles('cheekR', 0.014, 2), effector: 'middle', grip: 'flat', dur: 1.2, tilt: 0.25 },
    ),
    ...brushOn('Right', along('forehead', 0, 1), prop, key, 0.8, { tick: undefined }),
  ],
  corrector: underEyes,
  foundation: faceBase,
  concealer: underEyes,
  powder: (key, prop) => [
    ...brushOn('Right', taps(along('forehead', 0, 1), 4, 0.008), prop, key, 1.0, { tick: reveal(key, 0, 0.35), noOut: true, tilt: 0.3 }),
    ...brushOn('Right', glide(along('forehead', 0, 1), along('underEyeR', 0, 1)), prop, key, 0.35, { noIn: true, noOut: true, tick: undefined, tilt: 0.3 }),
    ...brushOn('Right', taps(along('underEyeR', 0, 1), 3, 0.008), prop, key, 0.8, { noIn: true, noOut: true, tick: reveal(key, 0.35, 0.6), tilt: 0.3 }),
    ...brushOn('Right', glide(along('underEyeR', 0, 1), along('nose', 0, 1)), prop, key, 0.35, { noIn: true, noOut: true, tick: undefined, tilt: 0.3 }),
    ...brushOn('Right', taps(along('nose', 0, 1), 2, 0.008), prop, key, 0.6, { noIn: true, noOut: true, tick: reveal(key, 0.6, 0.8), tilt: 0.3 }),
    ...brushOn('Right', glide(along('nose', 0, 1), along('chin', 0, 1)), prop, key, 0.35, { noIn: true, noOut: true, tick: undefined, tilt: 0.3 }),
    ...brushOn('Right', taps(along('chin', 0, 1), 3, 0.008), prop, key, 0.7, { noIn: true, tick: reveal(key, 0.8, 1), tilt: 0.3 }),
  ],
  contour: (key, prop) => cheeks(key, prop, hollow('L'), hollow('R'), 1.1),
  bronzer: (key, prop) => cheeks(key, prop, three('L'), three('R'), 1.2),
  blush: (key, prop) => cheeks(key, prop, circles('cheekL', 0.011, 2.5), circles('cheekR', 0.011, 2.5), 1.0),
  highlight: (key, prop) => [...cheeks(key, prop, cheekbone('L'), cheekbone('R'), 0.9), ...brushOn('Right', along('nose', 0, 0.6), prop, key, 0.6, { tick: undefined })],
  setting: (key) => {
    const spray: PropState = { id: 'spray', hold: 'grip' }
    const aim = (t: number, ctx: MoveCtx) => ({ ...holdAt('Right', { out: 0.32, up: 0.16, across: 0.02 })(t, ctx), weight: Math.min(1, t * 3) })
    return [
      { dur: 0.7, right: aim, props: { Right: spray } },
      { dur: 1.4, right: (t, ctx) => ({ ...aim(t, ctx), weight: 1 }), props: { Right: spray }, face: eyesClosed, tick: (t) => (reveal(key)(t), (fx.skin.wet.forehead = fx.skin.wet.cheekL = fx.skin.wet.cheekR = fx.skin.wet.nose = fx.skin.wet.chin = 0.35 * Math.sin(t * Math.PI))) },
      { dur: 0.5, right: (t, ctx) => ({ ...aim(1, ctx), weight: 1 - t }), props: { Right: spray }, face: (t) => ({ Expr_BlinkL: 1 - t, Expr_BlinkR: 1 - t }) },
    ]
  },
  eyeshadow: (key, prop) => [
    ...brushOn('Right', eyeLine('R', 0.02, -0.006, 0.012, 0.004), prop, key, 1.0, { tick: reveal(key, 0, 0.5), face: eyesClosed, gap: 0.002, tilt: 0.75 }),
    ...brushOn('Left', eyeLine('L', 0.02, -0.006, 0.012, 0.004), prop, key, 1.0, { tick: reveal(key, 0.5, 1), face: eyesClosed, gap: 0.002, tilt: 0.75 }),
  ],
  innerCorner: (key, prop) => [
    ...brushOn('Right', taps(eyeLine('R', 0.009, -0.013, -0.013, 0.004), 3, 0.004), prop, key, 0.6, { tick: reveal(key, 0, 0.5), gap: 0.002, tilt: 0.8 }),
    ...brushOn('Left', taps(eyeLine('L', 0.009, -0.013, -0.013, 0.004), 3, 0.004), prop, key, 0.6, { tick: reveal(key, 0.5, 1), gap: 0.002, tilt: 0.8 }),
  ],
  liner: (key, prop) => [
    ...brushOn('Right', eyeLine('R', 0.013, -0.008, 0.016, 0.006), prop, key, 1.1, { tick: reveal(key, 0, 0.5), face: () => ({ Expr_Squint: 0.7 }), gap: 0.0015, tilt: 0.85 }),
    ...brushOn('Left', eyeLine('L', 0.013, -0.008, 0.016, 0.006), prop, key, 1.1, { tick: reveal(key, 0.5, 1), face: () => ({ Expr_Squint: 0.7 }), gap: 0.0015, tilt: 0.85 }),
  ],
  lowerLiner: (key, prop) => [
    ...brushOn('Right', eyeLine('R', 0.005, -0.006, 0.012, 0.006), prop, key, 1.0, { tick: reveal(key, 0, 0.5), face: () => ({ Expr_BrowsUp: 0.6 }), gap: 0.0015, tilt: 0.85 }),
    ...brushOn('Left', eyeLine('L', 0.005, -0.006, 0.012, 0.006), prop, key, 1.0, { tick: reveal(key, 0.5, 1), face: () => ({ Expr_BrowsUp: 0.6 }), gap: 0.0015, tilt: 0.85 }),
  ],
  mascara: (key, prop) => {
    const wiggle =
      (s: 'L' | 'R'): Contact =>
      (t, ctx) => {
        const r = eyeLine(s, 0.012 + 0.006 * t, 0.002 + 0.004 * Math.sin(t * 18), 0.002 + 0.004 * Math.sin(t * 18), 0.012)(t, ctx)
        return r
      }
    const face = () => ({ Expr_Open: 0.3, Expr_BrowsUp: 0.6 })
    return [...brushOn('Right', wiggle('R'), prop, key, 1.2, { face, gap: 0.004, tilt: 1.2 }), ...brushOn('Left', wiggle('L'), prop, key, 1.2, { face, gap: 0.004, tilt: 1.2 })]
  },
  lipLiner: (key, prop) => [
    ...brushOn('Right', along('lips', 0, 1), prop, key, 1.2, { tick: reveal(key), face: () => ({ Expr_Pout: 0.25 }), gap: 0.0015, tilt: 0.9 }),
  ],
  lipstick: (key, prop) => [
    ...brushOn('Right', along('lips', 0, 1), prop, key, 0.9, { tick: reveal(key, 0, 0.6), face: () => ({ Expr_Open: 0.12 }), gap: 0.0015, tilt: 0.9, noOut: true }),
    ...brushOn('Right', along('lips', 1, 0), prop, key, 0.8, { noIn: true, tick: reveal(key, 0.6, 1), face: () => ({ Expr_Open: 0.12 }), gap: 0.0015, tilt: 0.9 }),
    { dur: 0.6, face: (t) => ({ Expr_Pout: Math.sin(t * Math.PI) * 0.5 }) },
  ],
  lipCentre: (key, prop) => [...brushOn('Right', taps(at('lips'), 3, 0.004), prop, key, 0.8, { tick: reveal(key), gap: 0.0015, tilt: 0.9 })],
  gloss: (key, prop) => [
    ...brushOn('Right', along('lips', 0, 1), prop, key, 0.9, { tick: undefined, gap: 0.0015, tilt: 0.9, noOut: true }),
    ...brushOn('Right', along('lips', 1, 0), prop, key, 0.8, { noIn: true, tick: undefined, gap: 0.0015, tilt: 0.9 }),
  ],
  brows: (_key, prop) => [
    ...brushOn('Right', eyeLine('R', 0.034, -0.012, 0.018, 0.004), prop, 'brow', 1.0, { tick: undefined, gap: 0.0015, tilt: 0.8 }),
    ...brushOn('Left', eyeLine('L', 0.034, -0.012, 0.018, 0.004), prop, 'brow', 1.0, { tick: undefined, gap: 0.0015, tilt: 0.8 }),
  ],
}

/* ------------------------------------------------------------------ steps */

export const LAYER_NAMES: Record<MakeupKey, string> = {
  primer: 'Primer',
  corrector: 'Colour corrector',
  foundation: 'Foundation',
  concealer: 'Concealer',
  powder: 'Setting powder',
  contour: 'Contour',
  bronzer: 'Bronzer',
  blush: 'Blush',
  highlight: 'Highlighter',
  setting: 'Setting spray',
  eyeshadow: 'Eyeshadow',
  innerCorner: 'Inner-corner highlight',
  liner: 'Eyeliner',
  lowerLiner: 'Lower liner',
  mascara: 'Mascara',
  lipLiner: 'Lip liner',
  lipstick: 'Lipstick',
  lipCentre: 'Ombre centre',
  gloss: 'Lip gloss',
}

const FRAMING: Partial<Record<MakeupKey, StepDef['framing']>> = { eyeshadow: 'eyes', innerCorner: 'eyes', liner: 'eyes', lowerLiner: 'eyes', mascara: 'eyes', lipLiner: 'lips', lipstick: 'lips', lipCentre: 'lips', gloss: 'lips' }

const isLayer = (v: unknown): v is Layer => !!v && typeof v === 'object' && 'color' in v

function propFor(key: MakeupKey, option: string | null, color: string): PropState | null {
  const list = APPLICATORS[key] ?? []
  const a = list.find((x) => x.id === option) ?? list[0]
  if (!a?.prop) return null
  return { id: a.prop, hold: a.prop === 'spray' ? 'grip' : 'pinch', color }
}

/**
 * Apply one product. ctx.product.color is the shade; ctx.extra.amount the intensity;
 * ctx.extra.finish a base finish (foundation) or lip finish (lipstick); ctx.option the applicator.
 */
export function makeupStep(key: MakeupKey): StepDef {
  return {
    id: `makeup:${key}`,
    name: LAYER_NAMES[key],
    blurb: '',
    framing: FRAMING[key] ?? 'face',
    regions: [key],
    products: [],
    mode: 'preview',
    before: () => void (fx.makeup.reveal[key] = 0),
    moves: (ctx) => ANIMS[key](key, propFor(key, ctx.option, ctx.product.color), ctx),
    apply: (l, ctx) => {
      const amount = typeof ctx.extra?.amount === 'number' ? ctx.extra.amount : 0.6
      const m = l.makeup
      if (key === 'primer' || key === 'mascara' || key === 'setting' || key === 'gloss') m[key] = amount
      else {
        const layer = m[key]
        if (isLayer(layer)) {
          layer.color = ctx.product.color
          layer.amount = amount
        }
      }
      if (key === 'foundation' && typeof ctx.extra?.finish === 'string') m.foundationFinish = ctx.extra.finish as Finish
      if (key === 'lipstick' && typeof ctx.extra?.finish === 'string') m.lipFinish = ctx.extra.finish as LipFinish
      if (key === 'eyeshadow' && typeof ctx.extra?.shimmer === 'number') m.eyeshadow.shimmer = ctx.extra.shimmer
    },
    done: `${LAYER_NAMES[key]} on.`,
  }
}

/** Take one product off with a makeup-remover pad (the layer fades out under the pad). */
export function removeStep(key: MakeupKey): StepDef {
  return {
    id: `remove:${key}`,
    name: `Remove ${LAYER_NAMES[key].toLowerCase()}`,
    blurb: '',
    framing: FRAMING[key] ?? 'face',
    regions: [key],
    products: [],
    mode: 'result',
    blocked: (l) => (amountOf(l.makeup, key) > 0.001 ? null : `No ${LAYER_NAMES[key].toLowerCase()} on right now.`),
    moves: () => {
      const pad: PropState = { id: 'pad', hold: 'pinch', load: 1 }
      const lips = FRAMING[key] === 'lips'
      const eyes = FRAMING[key] === 'eyes'
      const contact = lips ? along('lips', 0, 1) : eyes ? along('underEyeR', 0, 1) : circles('cheekR', 0.014, 2)
      const second = lips ? along('lips', 1, 0) : eyes ? along('underEyeL', 0, 1) : circles('cheekL', 0.014, 2)
      return [
        ...stroke({ side: 'Right', contact, prop: pad, dur: 0.9, tick: reveal(key, 1, 0.5), face: eyes ? eyesClosed : undefined }),
        ...stroke({ side: lips ? 'Right' : 'Left', contact: second, prop: pad, dur: 0.9, tick: reveal(key, 0.5, 0), face: eyes ? eyesClosed : undefined }),
      ]
    },
    apply: (l) => {
      const m = l.makeup
      if (key === 'primer' || key === 'mascara' || key === 'setting') m[key] = 0
      else if (key === 'gloss') m.gloss = DEFAULT_MAKEUP.gloss
      else {
        const layer = m[key]
        if (isLayer(layer)) layer.amount = 0
      }
    },
    verify: (l) => amountOf(l.makeup, key) < 0.001 || key === 'gloss',
    done: `${LAYER_NAMES[key]} removed.`,
  }
}

export function amountOf(m: Makeup, key: MakeupKey): number {
  const v = m[key]
  return typeof v === 'number' ? v : isLayer(v) ? v.amount : 0
}

/** The keys a look actually uses, in application order. */
const ORDER: MakeupKey[] = ['primer', 'corrector', 'foundation', 'concealer', 'powder', 'contour', 'bronzer', 'blush', 'highlight', 'eyeshadow', 'innerCorner', 'liner', 'lowerLiner', 'mascara', 'lipLiner', 'lipstick', 'lipCentre', 'setting']

/** Take everything off with remover pads (before a new full look). */
export const REMOVE_ALL: StepDef = {
  id: 'makeup:removeAll',
  name: 'Remove makeup',
  blurb: 'Micellar pads over the whole face.',
  framing: 'face',
  regions: ['face'],
  products: [],
  mode: 'result',
  moves: () => {
    const pad: PropState = { id: 'pad', hold: 'pinch', load: 1 }
    const off = (from: number, to: number) => (t: number) => {
      for (const k of ORDER) fx.makeup.reveal[k] = from + (to - from) * ease(t)
    }
    return [
      ...stroke({ side: 'Right', contact: circles('cheekR', 0.014, 2), prop: pad, dur: 0.8, tick: off(1, 0.7), noOut: true }),
      ...stroke({ side: 'Right', contact: glide(circles('cheekR', 0.014, 2), along('forehead', 0, 1)), prop: pad, dur: 0.35, noIn: true, noOut: true }),
      ...stroke({ side: 'Right', contact: along('forehead', 0, 1), prop: pad, dur: 0.8, noIn: true, tick: off(0.7, 0.45) }),
      ...stroke({ side: 'Left', contact: circles('cheekL', 0.014, 2), prop: pad, dur: 0.8, tick: off(0.45, 0.25), noOut: true }),
      ...stroke({ side: 'Left', contact: glide(circles('cheekL', 0.014, 2), along('underEyeL', 0, 1)), prop: pad, dur: 0.35, noIn: true, noOut: true }),
      ...stroke({ side: 'Left', contact: along('underEyeL', 0, 1), prop: pad, dur: 0.6, noIn: true, tick: off(0.25, 0.1), face: eyesClosed }),
      ...stroke({ side: 'Right', contact: along('lips', 0, 1), prop: pad, dur: 0.6, tick: off(0.1, 0) }),
    ]
  },
  apply: (l) => void (l.makeup = structuredClone(DEFAULT_MAKEUP)),
  verify: (l) => ORDER.every((k) => amountOf(l.makeup, k) < 0.001),
  done: 'Clean canvas.',
}

/**
 * A full look, applied product by product with the same animations, so the face transforms
 * gradually (and every layer stays editable afterwards).
 */
export function lookStep(presetId: string): StepDef {
  const preset = MAKEUP_PRESETS.find((p) => p.id === presetId)!
  return {
    id: `look:${presetId}`,
    name: preset.name,
    blurb: preset.blurb,
    framing: 'face',
    regions: ['face', 'eyes', 'lips'],
    products: [],
    mode: 'preview',
    before: () => {
      for (const k of ORDER) fx.makeup.reveal[k] = 0
    },
    moves: (ctx) => {
      const m = preset.build(ctx.look.skin.tone)
      const moves: Move[] = []
      for (const k of ORDER) {
        if (amountOf(m, k) < 0.02) continue
        const v = m[k]
        const color = isLayer(v) ? v.color : '#ffffff'
        const steps = ANIMS[k](k, propFor(k, null, color), ctx)
        // quicker per product: it's a whole look
        moves.push(...steps.map((s) => ({ ...s, dur: s.dur * 0.55 })))
      }
      return moves
    },
    apply: (l) => {
      l.makeup = preset.build(l.skin.tone)
    },
    done: `${preset.name} look done. Tweak any layer you like.`,
  }
}

export function shadeProduct(color: string, name = 'Shade'): Product {
  return { id: color, name, blurb: '', color }
}

/** Brow fill with the pencil (style and colour). */
export const BROW_STEP: StepDef = {
  id: 'brows',
  name: 'Brows',
  blurb: 'Fine hair-like strokes along each brow.',
  framing: 'eyes',
  regions: ['brows'],
  products: [],
  mode: 'preview',
  moves: (ctx) => ANIMS.brows('brow', { id: 'pencil', hold: 'pinch', color: ctx.product.color }, ctx),
  apply: (l, ctx) => {
    l.brows.color = ctx.product.color
    if (typeof ctx.extra?.style === 'string') l.brows.style = ctx.extra.style as StudioLook['brows']['style']
  },
  done: 'Brows defined.',
}

