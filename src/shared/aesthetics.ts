import type { Aesthetic } from './types'

export const AESTHETICS: { id: Aesthetic; label: string }[] = [
  { id: 'streetwear', label: 'Streetwear' },
  { id: 'soft-glam', label: 'Soft glam' },
  { id: 'goth', label: 'Goth' },
  { id: 'kawaii', label: 'Kawaii' },
  { id: 'luxury', label: 'Luxury' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'y2k', label: 'Y2K' },
  { id: 'alt', label: 'Alt' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'owambe', label: 'Owambe' },
]

export const AESTHETIC_LABEL = Object.fromEntries(AESTHETICS.map((a) => [a.id, a.label])) as Record<Aesthetic, string>

export function isAesthetic(v: unknown): v is Aesthetic {
  return typeof v === 'string' && v in AESTHETIC_LABEL
}
