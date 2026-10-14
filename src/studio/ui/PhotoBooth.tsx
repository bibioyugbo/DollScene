import { useEffect, useState } from 'react'
import { download } from '../photos'
import { takePhoto } from '../stage/capture'
import { useStudio, type Framing } from '../state/store'
import { Icon } from './icons'
import { click, haptic, sfx } from './sound'

/**
 * Take a picture: everything else hides and the player picks a shot. A mirror selfie (full length,
 * phone up in front of her, flipped like a real mirror), a normal selfie (arm out, close up) or a
 * screen capture of what's on screen. The doll strikes the pose, the frame is captured (the 3D
 * canvas only: no UI is ever in the picture) and the real result is shown to save or share.
 */

export type ShotKind = 'mirror' | 'selfie' | 'screen'

const SHOTS: { id: ShotKind; name: string; sub: string }[] = [
  { id: 'mirror', name: 'Mirror selfie', sub: 'Full length, phone up' },
  { id: 'selfie', name: 'Selfie', sub: 'Arm out, close up' },
  { id: 'screen', name: 'Screen capture', sub: 'Exactly what’s on screen' },
]

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A mirror shot reads left-right reversed, like the real thing. */
async function mirrored(blob: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(blob)
  const c = document.createElement('canvas')
  c.width = bmp.width
  c.height = bmp.height
  const g = c.getContext('2d')!
  g.translate(c.width, 0)
  g.scale(-1, 1)
  g.drawImage(bmp, 0, 0)
  bmp.close()
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('empty'))), 'image/png'))
}

/** Take one shot of the doll (also used by Make a Scene's Selfie action). */
export async function shoot(kind: ShotKind): Promise<Blob> {
  const st = useStudio.getState()
  const prev: Framing = st.framing
  if (kind !== 'screen') {
    useStudio.setState({ shot: kind })
    if (st.phase !== 'event') st.setFraming(kind === 'mirror' ? 'full' : 'bust')
    // the pose blends in (~0.45 s) and the camera eases to its framing
    await wait(1100)
  } else await new Promise((r) => requestAnimationFrame(() => r(null)))
  try {
    const raw = await takePhoto()
    return kind === 'mirror' ? await mirrored(raw) : raw
  } finally {
    if (kind !== 'screen') {
      useStudio.setState({ shot: null })
      if (st.phase !== 'event') useStudio.getState().setFraming(prev)
    }
  }
}

/** Save or share a photo (the share sheet on phones that have one, else a download). */
export async function sharePhoto(blob: Blob, name: string) {
  const file = new File([blob], name, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'DollScene' })
      return
    } catch {
      /* cancelled: nothing to do */
      return
    }
  }
  download(blob, name)
}

export function PhotoResult({ blob, onRetake, onDone }: { blob: Blob; onRetake: () => void; onDone: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setSrc(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  const name = `dollscene-${Date.now()}.png`
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-label="Your photo">
      {src && <img src={src} alt="Your photo" className="ds-pop max-h-[70dvh] max-w-full rounded-2xl object-contain shadow-[0_20px_60px_rgb(0_0_0/0.6)] ring-4 ring-white" />}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => (click('go'), download(blob, name))} className="ds-cta flex min-h-11 items-center gap-1.5 rounded-full px-5 text-[14px] font-black">
          <Icon name="download" className="h-4 w-4" /> Save
        </button>
        {canShare && (
          <button type="button" onClick={() => (click('tap'), void sharePhoto(blob, name))} className="ds-fab flex min-h-11 items-center gap-1.5 rounded-full px-5 text-[14px] font-bold">
            Share
          </button>
        )}
        <button type="button" onClick={() => (click('tap'), onRetake())} className="ds-fab min-h-11 rounded-full px-5 text-[14px] font-bold">
          Retake
        </button>
        <button type="button" onClick={() => (click('tap'), onDone())} className="ds-fab min-h-11 rounded-full px-5 text-[14px] font-bold">
          Done
        </button>
      </div>
    </div>
  )
}

/** The studio's "Take a picture": pick a shot (all other UI hidden), then the result. */
export function PhotoBooth({ onClose }: { onClose: () => void }) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState<ShotKind | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    useStudio.setState({ booth: true, uiHidden: true })
    return () => useStudio.setState({ booth: false, uiHidden: false, shot: null })
  }, [])
  const take = async (kind: ShotKind) => {
    click('select')
    setBusy(kind)
    setFailed(false)
    try {
      const b = await shoot(kind)
      sfx('snip')
      haptic(18)
      setBlob(b)
    } catch (e) {
      console.error(e)
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }
  if (blob) return <PhotoResult blob={blob} onRetake={() => setBlob(null)} onDone={onClose} />
  if (busy)
    return (
      <p className="sr-only" role="status" aria-live="polite">
        Taking your picture…
      </p>
    )
  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-3 pb-[max(env(safe-area-inset-bottom),14px)]" role="dialog" aria-label="Take a picture">
      {failed && <p className="rounded-full bg-black/60 px-3 py-1 text-[13px] font-bold text-white">That one didn’t come out. Try again.</p>}
      <div className="flex w-full max-w-md gap-2">
        {SHOTS.map((s) => (
          <button key={s.id} type="button" onClick={() => void take(s.id)} className="ds-fab flex min-h-16 flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-center">
            <span className="text-[14px] font-black">{s.name}</span>
            <span className="text-[11px] font-semibold opacity-75">{s.sub}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => (click('tap'), onClose())} className="min-h-9 rounded-full px-4 text-[13px] font-bold text-white underline underline-offset-4 drop-shadow">
        Cancel
      </button>
    </div>
  )
}
