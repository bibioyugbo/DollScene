import type { Vector3 } from 'three'
import type { SpotId } from '../../shared/studio/look'

/**
 * Per-frame visual state for animations: what's on the skin right now (foam, wet, cream...), how
 * far a patch has peeled, a section's takedown progress. Shaders and props read it every frame.
 * It is never saved and never drives React renders: the look in the store is the saved truth, and
 * each routine writes its result there when (and only when) the step really completes.
 */

/** Face regions, matching the masks: faceD (forehead, cheekL, cheekR, nose), faceE.r (chin), faceE.g (perimeter). */
export const REGIONS = ['forehead', 'cheekL', 'cheekR', 'nose', 'chin', 'perimeter'] as const
export type Region = (typeof REGIONS)[number]
export type RegionAmounts = Record<Region, number>

export const zeroRegions = (): RegionAmounts => ({ forehead: 0, cheekL: 0, cheekR: 0, nose: 0, chin: 0, perimeter: 0 })

export interface SkinFx {
  /** Bubbly cleanser foam. */
  foam: RegionAmounts
  /** Water / toner wetness (gloss). */
  wet: RegionAmounts
  /** Unblended white cream (moisturiser, sunscreen) still sitting on the skin. */
  cream: RegionAmounts
  /** Serum / oil sheen. */
  sheen: RegionAmounts
  /** Cream dabbed under the eyes. */
  eyeCream: number
  /** Balm on the lips. */
  balm: number
  /** Spot treatment dabs, per blemish (0..1, fades as it absorbs). */
  dab: Partial<Record<SpotId, number>>
  /** Pimple squeeze 0..1 (the bump flattens; a tiny cartoon pop at the end). */
  squeeze: Partial<Record<SpotId, number>>
  /** Patch peel 0..1 per spot (lift, then off). */
  peel: Partial<Record<SpotId, number>>
  /** A patch pinched in the fingers: it leaves the skin and follows this world point. */
  held: { id: SpotId; p: Vector3 } | null
  /** Water droplets while splashing (the saved look.care.dew holds the result). */
  dew: number
  /** Dry flakes being scrubbed away 0..1. */
  flakesOff: number
  /** Soothing gel on a rash 0..1. */
  soothe: number
  /** Brightening serum on dark marks 0..1. */
  bright: number
  /** A popped / drained / treated mark healing away 0..1 (not reset between steps: it runs on its own clock). */
  heal: Partial<Record<SpotId, number>>
}

export interface HairFx {
  /** 0..1 extra wetness while washing (the look's hair.care.wet is the saved part). */
  wet: number
  /** Shampoo/conditioner foam on the hair 0..1. */
  foam: number
  /** Conditioner (creamy) 0..1. */
  cream: number
  /**
   * Progress 0..1 of the section being worked on (8 sections). Finished sections come from the
   * look's bitmask, so a section shows its new style only once its step really completes.
   */
  sections: number[]
}

export interface NailFx {
  /** Per nail (10: left thumb..pinky, right thumb..pinky) coat progress 0..1 for the step being applied. */
  coat: number[]
  /** Which coat is being painted. */
  stage: 'none' | 'prep' | 'base' | 'colour' | 'art' | 'top'
}

export interface MakeupFx {
  /** Reveal 0..1 of a makeup layer being applied (the look already holds the final value). */
  reveal: Partial<Record<string, number>>
}

export const fx = {
  skin: { foam: zeroRegions(), wet: zeroRegions(), cream: zeroRegions(), sheen: zeroRegions(), eyeCream: 0, balm: 0, dab: {}, squeeze: {}, peel: {}, held: null, dew: 0, flakesOff: 0, soothe: 0, bright: 0, heal: {} } as SkinFx,
  hair: { wet: 0, foam: 0, cream: 0, sections: [0, 0, 0, 0, 0, 0, 0, 0] } as HairFx,
  nails: { coat: new Array(10).fill(1), stage: 'none' } as NailFx,
  makeup: { reveal: {} } as MakeupFx,
}

export function resetSkinFx() {
  fx.skin.foam = zeroRegions()
  fx.skin.wet = zeroRegions()
  fx.skin.cream = zeroRegions()
  fx.skin.sheen = zeroRegions()
  fx.skin.eyeCream = 0
  fx.skin.balm = 0
  fx.skin.dab = {}
  fx.skin.squeeze = {}
  fx.skin.peel = {}
  fx.skin.held = null
  fx.skin.dew = 0
  fx.skin.flakesOff = 0
  fx.skin.soothe = 0
  fx.skin.bright = 0
}

export function resetHairFx() {
  fx.hair.wet = 0
  fx.hair.foam = 0
  fx.hair.cream = 0
  fx.hair.sections = [0, 0, 0, 0, 0, 0, 0, 0]
}

export function resetNailFx() {
  fx.nails.coat = new Array(10).fill(1)
  fx.nails.stage = 'none'
}

export function resetAllFx() {
  resetSkinFx()
  resetHairFx()
  resetNailFx()
  fx.makeup.reveal = {}
}
