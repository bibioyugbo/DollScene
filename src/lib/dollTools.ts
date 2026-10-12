import {
  BLUSH_SHADES,
  BODY_PRESETS,
  EDGE_STYLES,
  EYE_COLORS,
  FACE_PRESETS,
  HAIR_COLORS,
  HAIR_GROUPS,
  LIP_SHADES,
  NAIL_SHADES,
  SKIN_GROUPS,
  UNDERTONES,
} from '../data/customization'
import { backend } from '../services/backend'
import type { Appearance } from '../shared/types'

const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)]
const jitter = (v: number, amt = 0.25) => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * amt * 2))

/** Shuffle looks while keeping the starter, outfit, identity and paid work. */
export function randomizeAppearance(a: Appearance): Appearance {
  const face = FACE_PRESETS[Math.floor(Math.random() * FACE_PRESETS.length)]
  const body = BODY_PRESETS[Math.floor(Math.random() * BODY_PRESETS.length)]
  const next = structuredClone(a)
  next.skin = { ...next.skin, tone: pick(SKIN_GROUPS.flatMap((g) => g.tones)), undertone: pick(UNDERTONES).id, glow: Math.random() * 0.7 }
  next.face = { ...next.face, ...face.face, preset: face.id, eyeColor: pick(EYE_COLORS) }
  for (const k of ['nose', 'lips', 'eyeSize', 'eyeSpacing', 'eyeShape', 'brows'] as const) next.face[k] = jitter(next.face[k])
  next.body = { ...next.body, ...body.body, preset: body.id }
  next.hair = {
    ...next.hair,
    style: pick(HAIR_GROUPS.flatMap((g) => g.styles)).id,
    color: pick(HAIR_COLORS.slice(0, 9)),
    length: Math.random(),
    volume: 0.3 + Math.random() * 0.7,
    edges: { style: pick(EDGE_STYLES).id, density: Math.random(), swirl: Math.random() },
    dye: Math.random() < 0.3 ? { mode: pick(['ombre', 'highlights', 'bleached-tips', 'peekaboo'] as const), color2: pick(HAIR_COLORS), gloss: Math.random() } : { ...next.hair.dye, mode: 'solid' },
  }
  next.makeup = { ...next.makeup, lipstick: Math.random() < 0.7 ? pick(LIP_SHADES) : null, blush: Math.random() < 0.6 ? pick(BLUSH_SHADES) : null }
  next.nails = { ...next.nails, color: pick(NAIL_SHADES) }
  return next
}

/** Upload a portrait render and return its URL (inline data URL in offline mode). */
export async function uploadPortrait(uid: string, dataUrl: string | null): Promise<string | null> {
  if (!dataUrl) return null
  try {
    return await backend().storage.uploadDataUrl(`portraits/${uid}/${Date.now()}.jpg`, dataUrl)
  } catch {
    return null
  }
}
