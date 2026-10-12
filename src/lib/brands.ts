import { USE_FICTIONAL_BRANDS } from '../config/env'
import { BRAND_BY_ID } from '../shared/catalog'
import type { Brand } from '../shared/types'

/** Real names while licensing is pending or signed; fictional labels when the flag is on. */
export function brandName(b: Brand | string | undefined): string {
  const brand = typeof b === 'string' ? BRAND_BY_ID.get(b) : b
  if (!brand) return ''
  return USE_FICTIONAL_BRANDS ? brand.placeholderName : brand.name
}

export function brandPending(b: Brand | undefined): boolean {
  return !!b && b.licensedPending && !USE_FICTIONAL_BRANDS
}

export type ColourFamily = 'red' | 'pink' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'brown' | 'black' | 'white'

export const COLOUR_FAMILIES: { id: ColourFamily; swatch: string }[] = [
  { id: 'red', swatch: '#D7263D' },
  { id: 'pink', swatch: '#FF3D8B' },
  { id: 'orange', swatch: '#FF6B2C' },
  { id: 'yellow', swatch: '#FFC24D' },
  { id: 'green', swatch: '#00A88F' },
  { id: 'blue', swatch: '#2B4BAA' },
  { id: 'purple', swatch: '#A86BFF' },
  { id: 'brown', swatch: '#8C5A3C' },
  { id: 'black', swatch: '#1C1C1C' },
  { id: 'white', swatch: '#F5F0E6' },
]

export function colourFamily(hex: string): ColourFamily {
  const n = parseInt(hex.slice(1), 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (l < 0.18) return 'black'
  if (d < 0.12) return l > 0.75 ? 'white' : 'black'
  let h: number
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  if (l > 0.85) return 'white'
  if ((h < 40 || h > 345) && l < 0.45 && d < 0.5) return 'brown'
  if (h < 15 || h >= 345) return 'red'
  if (h < 40) return l < 0.5 ? 'brown' : 'orange'
  if (h < 65) return 'yellow'
  if (h < 170) return 'green'
  if (h < 250) return 'blue'
  if (h < 300) return 'purple'
  return 'pink'
}
