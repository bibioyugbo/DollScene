import type { HairId, StudioLook } from '../../shared/studio/look'
import { useStudio } from '../state/store'
import { haptic, sfx } from '../ui/sound'
import { brushStrokes, hairKind } from './haircare'
import type { Move } from './engine'
import type { StepDef } from './steps'

/**
 * Styling steps for the tile grid: a new hairstyle (brushed into place), a hair colour (combed
 * through), an outfit or shoes (a turn to show it off), jewellery (put on with a sparkle). Each is
 * one step: the change previews at the start and the animation plays once, start to finish.
 */

const ease = (t: number) => t * t * (3 - 2 * t)

/** A full turn on the spot so the new outfit shows from every side, with a sparkle at the start. */
function showOff(dur = 1.6): Move[] {
  return [
    {
      dur,
      tick: (t) => {
        if (t < 0.03) {
          sfx('zip')
          haptic(12)
        }
        if (t > 0.5 && t < 0.53) sfx('sparkle')
        useStudio.setState({ spin: ease(t) * Math.PI * 2 })
      },
      face: (t) => ({ Expr_Smile: 0.6 * Math.sin(t * Math.PI) }),
    },
    { dur: 0.05, tick: () => void useStudio.setState({ spin: 0 }) },
  ]
}

export function hairStyleStep(id: HairId, name: string, color?: string): StepDef {
  return {
    id: `hair:style:${id}`,
    name,
    blurb: '',
    framing: 'hair',
    regions: ['hair'],
    products: [],
    mode: 'preview',
    moves: () => {
      const kind = hairKind(id)
      const strokes = brushStrokes(kind, kind === 'locs' ? null : { id: kind === 'coily' ? 'comb' : 'hairbrush', hold: 'grip' })
      return [{ dur: 0.25, tick: (t: number) => void (t < 0.1 && sfx('whoosh')) }, ...strokes.slice(0, 6)]
    },
    apply: (l: StudioLook) => {
      l.hair.style = id
      l.hair.care.change = null
      l.hair.care.bonnet = false
      if (color) {
        if (l.hair.blend === 0) l.hair.tip = color
        l.hair.color = color
        l.hair.preset = 'custom'
      }
    },
    done: `${name}. Gorgeous.`,
  }
}

export function hairColourStep(name: string, color: string, tip?: string, shine?: number): StepDef {
  return {
    id: `hair:colour:${color}:${tip ?? ''}`,
    name,
    blurb: '',
    framing: 'hair',
    regions: ['hair'],
    products: [],
    mode: 'preview',
    moves: ({ look }) => {
      const kind = hairKind(look.hair.style)
      return brushStrokes(kind, kind === 'locs' ? null : { id: 'comb', hold: 'grip' }).slice(0, 6)
    },
    apply: (l) => {
      l.hair.color = color
      if (tip) {
        l.hair.tip = tip
        l.hair.blend = Math.max(l.hair.blend, 0.55)
      } else if (l.hair.blend === 0) l.hair.tip = color
      if (shine !== undefined) l.hair.shine = shine
      l.hair.preset = 'custom'
    },
    done: `${name}: coloured through.`,
  }
}

export function dressStep(name: string, change: (l: StudioLook) => void): StepDef {
  return {
    id: `dress:${name}`,
    name,
    blurb: '',
    framing: 'full',
    regions: ['body'],
    products: [],
    mode: 'preview',
    moves: () => showOff(),
    apply: (l) => change(l),
    done: `${name}: yes!`,
  }
}

export function wearStep(name: string, change: (l: StudioLook) => void, framing: StepDef['framing'] = 'face'): StepDef {
  return {
    id: `wear:${name}`,
    name,
    blurb: '',
    framing,
    regions: ['jewellery'],
    products: [],
    mode: 'preview',
    moves: () => [{ dur: 0.7, tick: (t) => void (t < 0.05 && (sfx('sparkle'), haptic(8))), face: (t) => ({ Expr_Smile: 0.5 * Math.sin(t * Math.PI) }) }],
    apply: (l) => change(l),
    done: `${name}: on.`,
  }
}
