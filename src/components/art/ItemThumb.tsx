import { useId } from 'react'
import type { CatalogItem } from '../../shared/types'
import { PatternDef } from './patterns'

/** Silhouettes on a 100x100 grid, keyed by template. */
const SHAPES: Record<string, string> = {
  tee: 'M30 22l-16 10 7 14 9-5v41h40V41l9 5 7-14-16-10c-3 6-10 8-20 8s-17-2-20-8z',
  crop: 'M30 26l-14 9 6 12 8-4v20h40V43l8 4 6-12-14-9c-3 5-10 7-20 7s-17-2-20-7z',
  tank: 'M35 20h6c2 8 16 8 18 0h6c0 10 4 14 4 22v40H31V42c0-8 4-12 4-22z',
  blouse: 'M32 22 12 36l8 14 10-6v38h40V44l10 6 8-14-20-14c-4 6-10 9-18 9s-14-3-18-9z',
  shirt: 'M32 20 14 30l6 16 10-4v40h40V42l10 4 6-16-18-10-8 8h-12zM50 28v54',
  corset: 'M32 24c6 4 30 4 36 0l4 34c-4 6-6 14-6 24H34c0-10-2-18-6-24z',
  buba: 'M30 20 8 38l10 12 12-8v40h40V42l12 8 10-12-22-18c-4 6-10 8-20 8s-16-2-20-8z',
  hoodie: 'M34 16c4-6 28-6 32 0l18 14-6 16-8-4v42H30V42l-8 4-6-16zM40 18c2 10 18 10 20 0',
  blazer: 'M32 18 14 28l4 56h16V40l16 20 16-20v44h16l4-56-18-10-14 22z',
  jacket: 'M32 18 12 30l6 18 10-6v42h44V42l10 6 6-18-20-12-18 8z',
  puffer: 'M30 18c-10 4-18 10-18 22v12h12v32h52V52h12V40c0-12-8-18-18-22-10 8-30 8-40 0zM24 50h52M24 64h52',
  agbada: 'M30 16 2 50l14 10 14-12v38h40V48l14 12 14-10-28-34c-4 6-12 8-20 8s-16-2-20-8z',
  kaftan: 'M34 14 14 34l10 8 8-6v52h36V36l8 6 10-8-20-20c-4 6-8 8-16 8s-12-2-16-8z',
  'mini-skirt': 'M32 30h36l8 34H24z',
  'midi-skirt': 'M34 20h32l10 62H24z',
  'maxi-skirt': 'M36 12h28l12 78H24z',
  wrapper: 'M32 16h36l6 70H26zM32 16l36 30',
  trousers: 'M32 14h36l4 74H54l-4-50-4 50H28z',
  cargo: 'M30 14h40l4 74H54l-4-50-4 50H26zM28 46h10v12H28zM62 46h10v12H62z',
  jeans: 'M32 14h36l6 74H55l-5-50-5 50H26zM32 22h36',
  shorts: 'M30 26h40l4 38H54l-4-18-4 18H26z',
  'mini-dress': 'M38 12h24l2 18 10 36H26l10-36z',
  'midi-dress': 'M38 8h24l2 22 14 52H22l14-52z',
  gown: 'M40 6h20l2 26 22 60H16l22-60z',
  boubou: 'M30 12 6 40l12 8 12-10v50h40V38l12 10 12-8-24-28c-4 6-12 8-20 8s-16-2-20-8z',
  jumpsuit: 'M36 10h28l2 26 4 52H54l-4-38-4 38H30l4-52z',
  bikini: 'M30 22c6 0 12 6 16 10h8c4-4 10-10 16-10v14c-8 6-32 6-40 0zM32 56h36l-6 16H38z',
  'one-piece': 'M34 12h8c2 8 14 8 16 0h8v30c0 10-6 18-8 34H42c-2-16-8-24-8-34z',
  sneakers: 'M14 54c8 0 14-4 18-12h14c4 6 10 8 18 10 12 2 22 8 22 18v6H14z',
  heels: 'M20 64c10-2 20-14 28-24 8 2 16 8 26 10 6 2 8 6 8 10H58l-4 20h-4l2-20H20z',
  boots: 'M30 14h22v40c6 2 22 6 28 12v12H30z',
  sandals: 'M14 64h72v8H14zM28 64c2-10 10-14 22-14s20 4 22 14',
  loafers: 'M14 56c10 0 18-6 28-6s22 4 30 8c8 4 14 8 14 14v4H14z',
  tote: 'M22 36h56l-6 50H28zM36 36c0-14 28-14 28 0',
  clutch: 'M14 40h72v32H14zM14 40l36 18 36-18',
  backpack: 'M28 28c0-12 44-12 44 0v54H28zM36 52h28v18H36z',
  gele: 'M14 60c4-30 68-30 72 0-10-8-22-6-36-20-14 14-26 12-36 20zM30 46l40-10M30 36l40 10',
  cap: 'M22 56c0-20 12-30 28-30s28 10 28 30zM50 56h40c-4 8-20 8-40 6',
  beret: 'M14 52c0-16 18-26 36-26s36 10 36 26c-12 6-60 6-72 0zM50 26v-6',
  headwrap: 'M20 58c0-24 14-36 30-36s30 12 30 36c-8-6-20-8-30-8s-22 2-30 8zM50 22c8-6 16-4 18 4-6-2-12 0-18-4z',
  'bucket-hat': 'M30 30h40l6 24H24zM12 54h76v8H12z',
  sunglasses: 'M8 40h84v6H8zM12 44c0 18 30 18 30 0zM58 44c0 18 30 18 30 0z',
  glasses: 'M8 42h84M14 42a14 14 0 1 0 28 0 14 14 0 1 0-28 0zM58 42a14 14 0 1 0 28 0 14 14 0 1 0-28 0z',
  hoops: 'M30 30a16 16 0 1 0 0.1 0zM70 30a16 16 0 1 0 0.1 0z',
  studs: 'M34 50a6 6 0 1 0 0.1 0zM66 50a6 6 0 1 0 0.1 0z',
  drops: 'M30 18v20M30 38l-8 16 8 16 8-16zM70 18v20M70 38l-8 16 8 16 8-16z',
  chain: 'M20 20c0 40 60 40 60 0',
  pendant: 'M20 18c0 32 60 32 60 0M50 42l-8 12 8 14 8-14z',
  'coral-beads': 'M20 18c0 40 60 40 60 0M24 34c0 30 52 30 52 0',
  'waist-beads': 'M10 50c20 16 60 16 80 0',
  bangle: 'M50 26a24 24 0 1 0 0.1 0z',
  watch: 'M40 14h20v16H40zM40 70h20v16H40zM50 30a20 20 0 1 0 0.1 0z',
  belt: 'M8 44h84v12H8zM42 40h18v20H42zM48 46h6v8h-6z',
  bralette: 'M22 34c8 0 16 8 26 14h4c10-6 18-14 26-14l2 18c-10 6-50 6-60 0zM34 20l6 18M66 20l-6 18',
  robe: 'M34 14 12 34l10 10 10-8v48h36V36l10 8 10-10-22-20-16 30zM30 56h40',
}

const OUTLINE_ONLY = new Set(['glasses', 'hoops', 'chain', 'pendant', 'coral-beads', 'waist-beads', 'bangle'])

const FURNITURE: Record<string, string> = {
  'sleeping-mat': 'M10 60h80v14H10z',
  'bed-single': 'M18 40h64v34H18zM18 74v8M82 74v8M18 40v-12h20v12',
  'bed-double': 'M10 44h80v30H10zM10 74v8M90 74v8M10 44V26h80v18M18 36h26v8H18zM56 36h26v8H56z',
  sofa: 'M10 46h80v30H10zM10 46V34h80v12M18 58h64',
  loveseat: 'M18 46h64v30H18zM18 46V34h64v12',
  armchair: 'M26 46h48v30H26zM26 46V30h48v16M18 50h8v26h-8zM74 50h8v26h-8z',
  beanbag: 'M18 74c0-30 14-44 32-44s32 14 32 44z',
  'coffee-table': 'M12 50h76v8H12zM18 58v20M82 58v20',
  'side-table': 'M30 40h40v8H30zM36 48v32M64 48v32',
  'ghana-must-go': 'M18 44h64v34H18zM18 44l8-8h48l8 8M30 36v-6h40v6M18 56h64M38 44v34M62 44v34',
  poster: 'M28 12h44v76H28zM40 30a10 10 0 1 0 20 0 10 10 0 1 0-20 0zM34 60h32',
  chandelier: 'M50 6v20M22 40h56M22 40c0 14 56 14 56 0M26 54l-4 12M40 58l-2 12M60 58l2 12M74 54l4 12',
  bouquet: 'M38 60h24l-4 30H42zM50 60V40M40 30a8 8 0 1 0 16 0 8 8 0 1 0-16 0zM52 26a8 8 0 1 0 16 0 8 8 0 1 0-16 0zM34 40a8 8 0 1 0 16 0 8 8 0 1 0-16 0z',
  'wine-rack': 'M20 14h60v76H20zM20 40h60M20 64h60M36 14v76M50 14v76M64 14v76',
  aquarium: 'M12 30h76v40H12zM12 70h76v18H12zM30 48c6-6 14-6 18 0-4 6-12 6-18 0zM60 56c4-4 10-4 12 0-2 4-8 4-12 0z',
  palm: 'M38 72h24v18H38zM50 72V40M50 40c-14-12-30-8-36 0M50 40c14-12 30-8 36 0M50 40c-8-16-4-28 0-32M50 40c8-16 4-28 0-32',
  cactus: 'M20 76h18v14H20zM62 76h18v14H62zM40 72h20v18H40zM29 76V54M71 76V58M50 72V30',
  'plant-hanging': 'M50 4v26M34 30h32c0 12-32 12-32 0zM36 40v30M46 40v44M56 40v36M64 40v26',
  'pet-cat': 'M30 74c0-14 10-22 22-22s20 8 20 22zM62 52l4-12 6 10M70 52l6-10 2 12M28 74c-8 0-10-8-4-10',
  'pet-dog': 'M26 74c0-14 10-22 24-22s22 8 22 22zM60 50a10 10 0 1 1 18 6l4 6h-8M60 50l-6 12M26 74c-8 0-8-10-2-12',
  'dining-table': 'M8 44h84v8H8zM14 52v30M86 52v30',
  chair: 'M34 20h32v28H34zM30 48h40v8H30zM32 56v26M68 56v26',
  stool: 'M30 30h40v8H30zM34 38l-4 44M66 38l4 44',
  desk: 'M8 40h84v8H8zM12 48v34M88 48v34M60 48h28v20H60z',
  bookshelf: 'M24 8h52v84H24zM24 30h52M24 52h52M24 72h52',
  'tv-stand': 'M10 62h80v20H10zM20 16h60v40H20z',
  wardrobe: 'M20 6h60v88H20zM50 6v88M44 50v6M56 50v6',
  'clothes-rack': 'M14 20h72M18 20v70M82 20v70M30 20v22h10V20M46 20v26h10V20M62 20v20h10V20',
  vanity: 'M14 56h72v30H14zM30 10h40v40H30zM50 56v30',
  dresser: 'M14 34h72v52H14zM14 52h72M14 70h72',
  'mirror-floor': 'M34 10c0-6 32-6 32 0v80H34z',
  'floor-lamp': 'M34 12h32l-8 18H42zM50 30v56M38 88h24',
  'table-lamp': 'M30 30h40l-10 22H40zM50 52v24M38 78h24',
  'neon-sign': 'M10 32h80v36H10zM22 50c6-10 12 10 18 0s12 10 18 0 12 10 18 0',
  'plant-tall': 'M38 70h24l-4 20H42zM50 70V20M50 40c-14-4-18-16-14-24M50 34c14-4 18-16 14-24M50 54c-12 0-18-8-18-16M50 50c12 0 18-8 18-16',
  'plant-small': 'M36 62h28l-4 24H40zM50 62c-12-2-16-14-10-24 4 8 8 12 10 24zM50 62c12-2 16-14 10-24-4 8-8 12-10 24z',
  'rug-round': 'M50 22a38 22 0 1 0 0.1 0z',
  'rug-rect': 'M8 30h84v40H8zM16 38h68v24H16z',
  'art-frame': 'M22 12h56v76H22zM30 20h40v60H30z',
  'wall-shelf': 'M10 52h80v8H10zM20 30h12v22H20zM40 36h10v16H40zM66 40c0-6 14-6 14 0v12H66z',
  'wall-mirror': 'M50 10a32 40 0 1 0 0.1 0z',
  'kitchen-counter': 'M6 44h88v40H6zM6 54h88M30 54v30M70 54v30',
  fridge: 'M28 6h44v88H28zM28 38h44M64 18v12M64 46v14',
  stove: 'M20 34h60v52H20zM20 46h60M32 40h4M48 40h4M64 40h4M30 56h40v22H30z',
  bathtub: 'M8 46h84v18c0 12-10 18-20 18H28C18 82 8 76 8 64zM16 46V30c0-8 12-8 12 0',
  sink: 'M24 40h52c0 16-10 24-26 24S24 56 24 40zM44 64h12v24H44zM50 40V26h10',
  speaker: 'M32 10h36v80H32zM50 34a8 8 0 1 0 0.1 0zM50 62a12 12 0 1 0 0.1 0z',
}

/** Flat thumbnail for any catalog item. */
export function ItemThumb({ item, className = 'size-full' }: { item: CatalogItem; className?: string }) {
  const id = useId().replace(/:/g, '')
  const [c1, c2] = item.colors
  const fill = item.pattern === 'solid' ? c1 : `url(#p${id})`

  if (item.template === 'unlock') {
    const u = item.unlock
    return (
      <svg viewBox="0 0 100 100" className={className} aria-hidden>
        <rect width="100" height="100" fill="var(--muted)" />
        {u?.kind === 'shade' ? (
          item.name.startsWith('Polish') ? (
            <g>
              <rect x="38" y="16" width="24" height="22" rx="4" fill="#1E0B26" />
              <rect x="28" y="38" width="44" height="46" rx="12" fill={u.color} stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
            </g>
          ) : (
            <g>
              <rect x="36" y="50" width="28" height="36" rx="4" fill="#D4AF37" />
              <path d="M40 50V26l20-10v34z" fill={u.color} />
            </g>
          )
        ) : (
          <g>
            <circle cx="50" cy="50" r="26" fill="none" stroke={c1} strokeWidth="8" />
            <circle cx="50" cy="24" r="7" fill={c2} />
            <circle cx="74" cy="56" r="7" fill={c2} />
            <circle cx="30" cy="66" r="7" fill={c2} />
          </g>
        )}
      </svg>
    )
  }

  const d = item.furniture ? FURNITURE[item.template] : SHAPES[item.template]
  const outline = OUTLINE_ONLY.has(item.template)
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <defs>
        <PatternDef id={`p${id}`} pattern={item.pattern} c1={c1} c2={c2} />
      </defs>
      <rect width="100" height="100" fill="var(--muted)" />
      {d && (
        <path
          d={d}
          fill={outline ? 'none' : fill}
          stroke={outline ? c1 : '#1E0B26'}
          strokeOpacity={outline ? 1 : 0.18}
          strokeWidth={outline ? 6 : 1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          fillRule="evenodd"
        />
      )}
    </svg>
  )
}
