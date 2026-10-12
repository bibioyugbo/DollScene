import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { WalletChip } from '../components/AppShell'
import { Icon } from '../components/Icon'
import { SceneFallback } from '../components/SceneFallback'
import { runAction } from '../hooks/useAction'
import { useHistory } from '../hooks/useHistory'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { uploadPortrait } from '../lib/dollTools'
import { buttonClass, cx, formatGlam } from '../lib/ui'
import { appearanceBill, applyProcedure, billTotal, sanitizeAppearance } from '../shared/appearance'
import { CLINIC_BY_ID, CLINIC_PROCEDURES, type ClinicProcedure } from '../shared/economy'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import type { DollStageHandle } from '../three/DollStage'

const DollStage = lazy(() => import('../three/DollStage'))

type Area = 'face' | 'body' | 'skin'
const AREAS: { id: Area; label: string; emoji: string }[] = [
  { id: 'face', label: 'Face', emoji: '💋' },
  { id: 'body', label: 'Body', emoji: '🍑' },
  { id: 'skin', label: 'Skin', emoji: '✨' },
]
const areaOf = (p: ClinicProcedure): Area => (p.body ? 'body' : p.face ? 'face' : 'skin')
const EMOJI: Record<string, string> = {
  smoothing: '💉',
  'lip-filler': '💋',
  rhinoplasty: '👃',
  jawline: '💎',
  chin: '🫦',
  'brow-lift': '🪄',
  smile: '😁',
  facial: '🧖🏾‍♀️',
  bbl: '🍑',
  'breast-lift': '👙',
  'tummy-tuck': '⏳',
  lipo: '🫧',
  contour: '⌛',
}

/** The Beauty Doctor: Botox, fillers, BBL and more. Preview live, see the bill, pay only when you're happy. */
export default function BeautyDoctor() {
  const navigate = useNavigate()
  const doll = useSession((s) => s.doll)!
  const uid = useSession((s) => s.user!.uid)
  const dollies = useSession((s) => s.progress?.dollies ?? 0)
  const starterChanges = useSession((s) => s.profile?.starterChanges ?? 0)
  const reducedMotion = useReducedMotion()
  const stage = useRef<DollStageHandle>(null)
  const saved = useMemo(() => sanitizeAppearance(doll.appearance), [doll.appearance])
  const history = useHistory(saved)
  const [area, setArea] = useState<Area>('face')
  const [busy, setBusy] = useState(false)

  const booked = history.value.clinic.slice(saved.clinic.length)
  const lines = appearanceBill(saved, history.value, starterChanges)
  const total = billTotal(lines)

  const pay = async () => {
    if (total > dollies) {
      toast.error(`This visit is ${formatGlam(total)} Glam. You have ${formatGlam(dollies)}.`)
      return
    }
    setBusy(true)
    const portrait = await uploadPortrait(uid, stage.current?.capturePortrait() ?? null)
    const res = await runAction('saveAppearance', { appearance: history.value, portrait, hairLooks: doll.hairLooks, complexionPresets: doll.complexionPresets, facePresets: doll.facePresets ?? [] })
    setBusy(false)
    if (res) {
      toast.success(`All done! ${formatGlam(res.charged ?? total)} Glam paid. Recovery: instant.`)
      history.reset(history.value)
    }
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground split:flex-row">
      <div className="relative h-[46dvh] shrink-0 split:h-full split:flex-1">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgb(255_46_136/0.18),transparent_60%),linear-gradient(180deg,#FFF5F9,#FFE3EF)] dark:bg-[radial-gradient(ellipse_at_50%_35%,rgb(255_46_136/0.25),transparent_60%),linear-gradient(180deg,#150A14,#07050B)]" />
        <Suspense fallback={<SceneFallback label="Prepping the clinic" />}>
          <DollStage ref={stage} appearance={history.value} lighting="studio" focus={area === 'body' ? 'full' : 'face'} undress={area === 'body'} reducedMotion={reducedMotion} label="Your doll in the clinic" />
        </Suspense>
        <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 px-4 pt-safe md:px-6 md:pt-5">
          <button type="button" className={buttonClass('secondary', 'md', 'pointer-events-auto')} onClick={() => (booked.length && !window.confirm('Leave without paying? Your bookings will be cancelled.') ? undefined : navigate('/crib'))}>
            <Icon name="back" className="size-4" /> Crib
          </button>
          <div className="pointer-events-auto">
            <WalletChip />
          </div>
        </header>
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
          <button type="button" aria-label="Undo" className={buttonClass('secondary', 'sm')} disabled={!history.canUndo} onClick={history.undo}>
            <Icon name="undo" className="size-4" />
          </button>
          <button type="button" className={buttonClass('secondary', 'sm')} disabled={!booked.length} onClick={() => history.set(saved)}>
            <Icon name="reset" className="size-4" /> Cancel all
          </button>
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col border-t border-border bg-card split:w-[400px] split:flex-none split:border-t-0 split:border-l">
        <div className="px-4 pt-4">
          <p className="text-xs font-bold tracking-[0.2em] text-primary uppercase">Dr. Doll’s clinic · Ikoyi</p>
          <h1 className="font-display text-2xl font-black">Beauty Doctor</h1>
          <p className="mt-1 text-xs text-muted-foreground">Fictional, optional and for adult avatars only. Preview first, pay only when you love it.</p>
          <div role="tablist" aria-label="Area" className="mt-3 flex gap-1 rounded-full bg-muted p-1">
            {AREAS.map((a) => (
              <button key={a.id} role="tab" type="button" aria-selected={area === a.id} onClick={() => setArea(a.id)} className={cx('min-h-9 flex-1 rounded-full text-sm font-semibold', area === a.id ? 'bg-card shadow' : 'text-muted-foreground')}>
                {a.emoji} {a.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto p-4">
          {CLINIC_PROCEDURES.filter((p) => areaOf(p) === area).map((p) => {
            const n = booked.filter((b) => b === p.id).length
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => history.set(applyProcedure(history.value, p))}
                  className={cx('relative flex h-full w-full flex-col items-start gap-1 rounded-2xl border-2 p-3 text-left transition-transform active:scale-95', n ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/60')}
                >
                  <span className="text-2xl" aria-hidden>
                    {EMOJI[p.id] ?? '💉'}
                  </span>
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.blurb}</span>
                  <span className="mt-auto pt-1 text-sm font-bold tabular-nums">{formatGlam(p.price)} G</span>
                  {n > 0 && <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-primary text-xs font-black text-ink">×{n}</span>}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-border px-4 py-3 pb-safe">
          {booked.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-1.5" aria-label="Booked today">
              {booked.map((id, i) => (
                <li key={`${id}-${i}`} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {CLINIC_BY_ID.get(id)?.name}
                </li>
              ))}
            </ul>
          )}
          <button type="button" className={buttonClass('primary', 'lg', 'w-full')} disabled={!booked.length || busy || total > dollies} onClick={pay}>
            {busy ? 'In surgery…' : !booked.length ? 'Tap a treatment to preview' : total > dollies ? `Need ${formatGlam(total - dollies)} more Glam` : `Pay & glow up · ${formatGlam(total)} G`}
          </button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Want hair, makeup or nails instead? <Link to="/makeover" className="font-semibold underline">Makeover</Link>
          </p>
        </div>
      </section>
    </div>
  )
}
