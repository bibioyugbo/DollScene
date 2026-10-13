import type { Category } from '../state/store'

/** One consistent line-icon set (24px grid, 1.6 stroke), drawn for the studio. */
export const PATHS = {
  wake: 'M12 3v2M5.6 5.6 7 7M3 12h2M19 12h2M17 7l1.4-1.4M7 16a5 5 0 0 1 10 0M3 19h18',
  skincare: 'M12 3.5c3 3.6 5 6.3 5 9a5 5 0 0 1-10 0c0-2.7 2-5.4 5-9Z M9.8 13.8a2.3 2.3 0 0 0 2.2 2.4',
  haircare: 'M4 10h16M6 10v5M9 10v7M12 10v5M15 10v7M18 10v5 M8 6c0-1 1-2.4 1-2.4S10 5 10 6a1 1 0 0 1-2 0Z M14 6c0-1 1-2.4 1-2.4S16 5 16 6a1 1 0 0 1-2 0Z',
  hairstyles: 'M7 20.5v-1.5a5 5 0 0 1 10 0v1.5 M6.2 11.5a5.8 5.8 0 1 1 11.6 0c0 2.8-1.2 4.2-1.2 6.5M6.2 11.5c0 2.8 1.2 4.2 1.2 6.5 M9 10.5a3 3 0 0 0 6 0',
  haircolour: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.4-1.2-1.6-1.2-2.8 0-.9.7-1.6 1.7-1.6H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7Z M7.5 11.5h.01M10 7.5h.01M15 7.5h.01',
  makeup: 'M18.5 3.5a2.1 2.1 0 0 1 3 3L13 15l-3-3 8.5-8.5Z M10 12l-3.2.6C5 13 4.4 14.6 4.3 16c-.1 1.3-.6 2.4-1.6 3.4 2.6 0 6.4-.6 7.5-3.4l.6-2.9',
  looks: 'M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z',
  browsLashes: 'M2.5 13s3.5-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.5 5.5-9.5 5.5S2.5 13 2.5 13Z M12 15.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M5.5 8 4.3 6.3M12 7.5V5.4M18.5 8l1.2-1.7',
  lips: 'M2.8 12c2.6-3.1 5-4.6 6.6-4.6 1 0 1.7.7 2.6.7s1.6-.7 2.6-.7c1.6 0 4 1.5 6.6 4.6-2.6 3.1-5.6 5-9.2 5s-6.6-1.9-9.2-5Z M2.8 12h18.4',
  nails: 'M8.5 21v-9.6a3.5 3.5 0 0 1 7 0V21 M10 10.8a2 2 0 0 1 4 0v2.2a2 2 0 0 1-4 0v-2.2Z',
  jewellery: 'M6 15a6 6 0 1 0 12 0 6 6 0 0 0-12 0Z M9.4 3.5h5.2L16.2 6 12 9.6 7.8 6l1.6-2.5Z',
  outfits: 'M12 7.2a2 2 0 1 1 2-2c0 1.1-2 1.5-2 2.8L3.6 14.3c-.8.6-.4 1.9.6 1.9h15.6c1 0 1.4-1.3.6-1.9L12 8',
  clinic: 'M4 20 14.5 9.5 M14.5 9.5l1.7-1.7a1.4 1.4 0 0 1 2 2l-1.7 1.7 M15 3.5v2M19 7.5h2M18 4.6l1.3-1.3M20.5 11.5h-1',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
  scene: 'M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21Z M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  photo: 'M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z M12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  // utility
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'm15 14 5-5-5-5m5 5H9.5a5.5 5.5 0 0 0 0 11H13',
  close: 'M6 6l12 12M18 6 6 18',
  eye: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  eyeOff: 'M3 3l18 18 M10.6 6.1c.5-.1.9-.1 1.4-.1 6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3 M6.5 7.6C4 9.4 2.5 12 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.2-1',
  turn: 'M20 12a8 8 0 1 1-2.3-5.7 M20 4v4h-4',
  check: 'M5 12.5 10 17.5 19 7',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  play: 'M8 5.5v13l10-6.5-10-6.5Z',
  replay: 'M4 12a8 8 0 1 0 2.3-5.7 M4 4v4h4',
  skip: 'M5 5.5v13l8-6.5-8-6.5Z M17 5v14',
  save: 'M6 3.5h9l3.5 3.5v13.5h-12.5V3.5Z M9 3.5v5h6v-5 M8.5 14h7',
  download: 'M12 4v11m-4.5-4.5L12 15l4.5-4.5 M5 19.5h14',
  compare: 'M12 3v18 M7 7l-4 5 4 5 M17 7l4 5-4 5',
  sparkle: 'M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Z',
  warning: 'M12 4 2.5 20h19L12 4Z M12 10v4.5 M12 17.2h.01',
  heart: 'M12 20s-7.5-4.4-7.5-10A4.5 4.5 0 0 1 12 7.4 4.5 4.5 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  location: 'M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21Z',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
  cleanse: 'M9 3.5h6v3H9z M8 6.5h8a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1Z M17.5 4.5a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0Z M19.5 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z',
  treat: 'M4 14c3-1 5 1 6 4M20 14c-3-1-5 1-6 4 M12 13.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z M12 6V4M9 7l-1-1.5M15 7l1-1.5',
  tone: 'M7 4h6v3H7z M6 7h8v13H6z M17 15a3 3 0 1 0 0 .01Z',
  moisturise: 'M5 11h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z M4 8h16v3H4z M10 5.5q2-2.5 4 0',
  base: 'M8 9h8v11a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V9Z M10 4h4v5h-4z M8 13h8',
  sculpt: 'M11 13a7 7 0 1 0 0 .01Z M11 9.5a3.5 3.5 0 1 0 0 .01Z M15.5 8.5 20 4',
  eyes: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  shoes: 'M3 16v-4l4-1 3 3 8 1.5a3 3 0 0 1 3 3V19H3v-3Z M3 16h18',
  clinicFace: 'M12 3c4 0 7 3.5 7 8.5S16 21 12 21s-7-4.5-7-9.5S8 3 12 3Z M9.5 10.5h.01M14.5 10.5h.01 M10 15q2 1.5 4 0',
  clinicBody: 'M12 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z M8 9h8l-1 6 1 6h-3l-1-4-1 4H8l1-6-1-6Z',
  hub: 'M3 21V8l9-5 9 5v13 M9 21v-7h6v7',
  drip: 'M9 3h6v6H9z M12 9v3 M12 13q-3 4 0 6 3-2 0-6Z',
  chat: 'M4 5h16v11H9l-5 4V5Z',
  people: 'M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M15.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M2.5 20a6 6 0 0 1 12 0 M12 16a6 6 0 0 1 9.5 4',
  send: 'M4 12 20 4l-6 16-3-6-7-2Z',
  flag: 'M5 21V4h11l-2 4 2 4H5',
  block: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M5.6 5.6l12.8 12.8',
  mute: 'M4 9h4l5-4v14l-5-4H4V9Z M17 9l4 6M21 9l-4 6',
  dice: 'M4 4h16v16H4z M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'h-5 w-5', title }: { name: IconName; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  )
}

export const CATEGORY_ICON: Record<Category, IconName> = {
  wake: 'wake',
  cleanse: 'cleanse',
  treat: 'treat',
  tone: 'tone',
  moisturise: 'moisturise',
  base: 'base',
  sculpt: 'sculpt',
  eyes: 'eyes',
  browsLashes: 'browsLashes',
  lips: 'lips',
  looks: 'looks',
  nails: 'nails',
  jewellery: 'jewellery',
  hairstyles: 'hairstyles',
  haircolour: 'haircolour',
  haircare: 'haircare',
  outfits: 'outfits',
  shoes: 'shoes',
  clinicFace: 'clinicFace',
  clinicBody: 'clinicBody',
}
