/** Small stroke icon set (24px grid). Decorative unless a label is given. */
const PATHS = {
  hub: 'M4 5h7v7H4zM13 5h7v4h-7zM13 11h7v8h-7zM4 14h7v5H4z',
  crib: 'M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6',
  shop: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  work: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  people: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6',
  chat: 'M4 5h16v11H9l-5 4z',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.5.4-2-3-1-1 1.8h-2l-1-1.8-3 1 .4 2L6 8.2 4 8l-1 3 2 1-.1 2-1.9 1 1 3 2-.2 1.3 1.5-.4 2 3 1 1-1.8h2l1 1.8 3-1-.4-2 1.3-1.5 2 .2 1-3-2-1z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM16 16l5 5',
  close: 'M6 6l12 12M18 6 6 18',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
  comment: 'M5 5h14v10H10l-5 4z',
  send: 'M4 12 20 4l-6 16-3-7z',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  play: 'M7 5v14l12-7z',
  pause: 'M7 5h4v14H7zM13 5h4v14h-4z',
  stop: 'M6 6h12v12H6z',
  reply: 'M10 8 4 13l6 5M4 13h10a6 6 0 0 1 6 6',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  block: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8',
  lock: 'M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  star: 'M12 4l2.4 5 5.6.6-4.2 3.8 1.2 5.6L12 16.3 7 19l1.2-5.6L4 9.6 9.6 9z',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  shuffle: 'M4 7h3c5 0 5 10 10 10h3M17 14l3 3-3 3M4 17h3c1.5 0 2.5-.8 3.3-2M13.7 9c.8-1.2 1.8-2 3.3-2h3M17 4l3 3-3 3',
  undo: 'M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2',
  redo: 'M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2',
  dice: 'M5 5h14v14H5zM9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01',
  reset: 'M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4',
  check: 'M5 12l5 5 9-10',
  coin: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v10M9.5 9.5c0-1.4 1.1-2 2.5-2s2.5.8 2.5 2-1 1.7-2.5 2-2.5.8-2.5 2 1.1 2 2.5 2 2.5-.6 2.5-2',
  gem: 'M6 4h12l3 5-9 11L3 9zM3 9h18M9 4l3 16 3-16',
  camera: 'M4 8h4l2-3h4l2 3h4v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  share: 'M12 4v12M7 9l5-5 5 5M5 14v6h14v-6',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  rotate: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
  move: 'M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  box: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  filter: 'M4 5h16l-6 8v6l-4-2v-4z',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  wardrobe: 'M5 3h14v18H5zM12 3v18M9.5 11v2M14.5 11v2',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  door: 'M6 21V3h12v18M14 12h.01M3 21h18',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  download: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  hanger: 'M12 7a2 2 0 1 1 2-2M12 7v2L3 16h18l-9-7',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  pin: 'M12 21s-6-6.3-6-11a6 6 0 0 1 12 0c0 4.7-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-5', label, filled = false }: { name: IconName; className?: string; label?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
