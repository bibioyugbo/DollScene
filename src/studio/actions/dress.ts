import type { HairId, StudioLook, TattooDesign, TattooSpot } from '../../shared/studio/look'
import { fx } from '../state/fx'
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

/**
 * A new hairstyle: it simply appears on her head. No hands, no brushing; the change is on the doll
 * the moment the tile is tapped (preview at the start) and kept a beat later. Colour is never
 * touched here: the Hair colour section owns it.
 */
export function hairStyleStep(id: HairId, name: string): StepDef {
  return {
    id: `hair:style:${id}`,
    name,
    blurb: '',
    framing: 'hair',
    regions: ['hair'],
    products: [],
    mode: 'preview',
    moves: () => [{ dur: 0.2, tick: (t: number) => void (t < 0.2 && sfx('whoosh')) }],
    apply: (l: StudioLook) => {
      l.hair.style = id
      l.hair.care.change = null
      l.hair.care.bonnet = false
    },
    verify: (l) => l.hair.style === id,
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

/** The artist inks a design: the buzz of the machine, then fresh, pink skin that settles. */
export function tattooStep(design: TattooDesign, at: TattooSpot, ink: string): StepDef {
  const name = `${design[0].toUpperCase()}${design.slice(1)} tattoo`
  return {
    id: `tattoo:${design}:${at}`,
    name,
    blurb: '',
    framing: 'full',
    regions: ['body'],
    products: [],
    mode: 'preview',
    moves: () => [
      {
        dur: 2.2,
        tick: (t) => {
          if (Math.floor(t * 8) !== Math.floor((t - 0.02) * 8)) sfx('buzz')
          fx.tattoo.fresh = Math.min(1, t * 1.6)
          if (t > 0.97) haptic(10)
        },
        face: (t) => ({ Expr_Wince: 0.35 * Math.sin(t * Math.PI) }),
      },
      { dur: 1.2, tick: (t) => void (fx.tattoo.fresh = 1 - t * 0.7) },
    ],
    apply: (l) => {
      l.tattoos = [...l.tattoos.filter((x) => x.at !== at), { design, at, ink, size: 1 }]
    },
    done: `${name}: inked. Keep it moisturised!`,
  }
}

/** Laser removal: pulses lift the ink until it's gone; the skin is left a little pink. */
export function tattooRemoveStep(design: TattooDesign, at: TattooSpot): StepDef {
  return {
    id: `tattoo-off:${at}`,
    name: `Remove the ${design}`,
    blurb: '',
    framing: 'full',
    regions: ['body'],
    products: [],
    // the ink only leaves the saved look once the laser has really lifted it
    mode: 'result',
    moves: () => [
      {
        dur: 2.6,
        tick: (t) => {
          if (Math.floor(t * 10) !== Math.floor((t - 0.02) * 10)) sfx('zap')
          fx.tattoo.fade[at] = t
          fx.tattoo.fresh = Math.min(1, t * 2) * 0.8
        },
        face: (t) => ({ Expr_Wince: 0.45 * Math.sin(t * Math.PI) }),
      },
      { dur: 1, tick: (t) => void (fx.tattoo.fresh = 0.8 * (1 - t)) },
    ],
    apply: (l) => {
      l.tattoos = l.tattoos.filter((x) => x.at !== at)
      delete fx.tattoo.fade[at]
      fx.tattoo.fresh = 0
    },
    done: 'Ink gone. The skin will settle in a day or two.',
  }
}
