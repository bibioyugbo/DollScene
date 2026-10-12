import { useMemo } from 'react'
import type { Look2D } from '../shared/look2d'
import { dollDataUrl, type DollCrop } from './renderDoll'

/**
 * A 2D DollScene character. `crop` picks full body, bust or head.
 * Drawn as an image so the painted shading is rasterised once, not on every repaint.
 */
export function Doll2D({ look, crop = 'full', className, label, bg }: { look: Look2D; crop?: DollCrop; className?: string; label?: string; bg?: string }) {
  const key = JSON.stringify(look)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures every field of the look
  const src = useMemo(() => dollDataUrl(look, { crop, bg }), [key, crop, bg])
  return (
    <span className={className} style={{ display: 'block' }}>
      <img src={src} alt={label ?? ''} aria-hidden={label ? undefined : true} draggable={false} decoding="async" className="block size-full object-contain" />
    </span>
  )
}
