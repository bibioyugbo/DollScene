import { useMemo, useState } from 'react'
import { useAction } from '../hooks/useAction'
import { useReducedMotion } from '../hooks/useMediaQuery'
import { formatGlam } from '../lib/ui'
import { avatarSummary } from '../shared/appearance'
import { getItem } from '../shared/catalog'
import { levelOf, pendingLevelRewards } from '../shared/levels'
import { STARTERS } from '../shared/starters'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import { DollFigure } from './art/DollFigure'
import { ItemThumb } from './art/ItemThumb'

const DANCERS = STARTERS.filter((_, i) => i % 3 === 0).slice(0, 9)
const CONFETTI = ['#FF2E88', '#C8FF3D', '#FFD95A', '#7CF0CF', '#A86BFF', '#FFFFFF']

/**
 * Levelling up is a big deal: the whole cast dances, confetti falls, and you
 * collect your Glam, free pieces and whatever just unlocked.
 */
export function LevelUpCelebration() {
  const progress = useSession((s) => s.progress)
  const signedIn = useSession((s) => s.status === 'signed-in' && !!s.profile?.onboarded)
  const reduced = useReducedMotion()
  const claim = useAction('claimLevelUp')
  const [hidden, setHidden] = useState<number | null>(null)
  const pending = pendingLevelRewards(progress)
  const level = levelOf(progress?.xp ?? 0).level
  const confetti = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ x: (i * 37) % 100, d: (i * 13) % 40 / 10, c: CONFETTI[i % CONFETTI.length], r: (i * 47) % 360, w: 6 + (i % 3) * 3 })), [])
  if (!signedIn || !pending.length || hidden === level) return null

  const glam = pending.reduce((n, r) => n + r.glam, 0)
  const items = pending.flatMap((r) => r.items).map((id) => getItem(id)).filter((i) => !!i)
  const features = pending.flatMap((r) => r.features)

  const collect = async () => {
    const r = await claim.run(undefined)
    if (!r) return
    setHidden(level)
    toast.success(`+${formatGlam(glam)} Glam${items.length ? ` and ${items.length} new piece${items.length > 1 ? 's' : ''} in your wardrobe` : ''} ✨`)
  }

  return (
    <div role="dialog" aria-modal aria-label={`Level ${level}! You levelled up`} className="fixed inset-0 z-[95] overflow-hidden bg-[radial-gradient(ellipse_at_50%_35%,#3B1A5E_0%,#140B24_70%)] text-white motion-safe:animate-[loader-in_.3s_ease-out]">
      {/* confetti */}
      {!reduced &&
        confetti.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute -top-6 block rounded-sm"
            style={{ left: `${p.x}%`, width: p.w, height: p.w * 1.6, background: p.c, transform: `rotate(${p.r}deg)`, animation: `confetti ${3 + (i % 4) * 0.6}s linear ${-p.d}s infinite` }}
          />
        ))}
      {/* spotlight + the dancing cast */}
      <div aria-hidden className="absolute inset-x-0 bottom-[30%] h-[46%] bg-[radial-gradient(ellipse_at_50%_100%,rgb(255_46_136/0.35),transparent_65%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-[24%] flex items-end justify-center gap-[1vw] px-4">
        {DANCERS.map((s, i) => (
          <div key={s.id} className="h-[min(30vh,240px)]" style={{ animation: reduced ? undefined : `doll-dance ${0.9 + (i % 3) * 0.12}s ease-in-out ${-i * 0.17}s infinite alternate`, transformOrigin: '50% 100%' }}>
            <DollFigure avatar={avatarSummary(s.appearance)} outfit={s.appearance.outfit} className="h-full w-auto" />
          </div>
        ))}
      </div>

      <div className="absolute inset-x-0 top-[6%] flex flex-col items-center px-4 text-center">
        <p className="text-sm font-black tracking-[0.3em] text-[#C8FF3D] uppercase">Level up!</p>
        <p className="font-spicy text-[clamp(4rem,14vw,9rem)] leading-none [text-shadow:0_0_24px_#FF2E88,0_6px_0_#C21767] motion-safe:animate-[cloud-pop_.6s_ease-out_both]">Level {level}</p>
        <p className="mt-1 text-base font-semibold text-white/80">The whole scene is celebrating you.</p>
      </div>

      <div className="absolute inset-x-0 bottom-4 flex justify-center px-4">
        <div className="w-full max-w-lg rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="flex items-center gap-2 rounded-2xl bg-[#FFD95A] px-3 py-2 font-black text-ink">
              <span aria-hidden className="grid size-6 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#FFF1B8,#F5C842_45%,#B8860B)] text-[11px]">G</span>+{formatGlam(glam)} Glam
            </span>
            {features.map((f) => (
              <span key={f} className="rounded-2xl bg-white/15 px-3 py-2 font-bold">
                🔓 {f}
              </span>
            ))}
          </div>
          {items.length > 0 && (
            <div className="mt-3 flex justify-center gap-2">
              {items.map((i) => (
                <span key={i!.id} title={i!.name} className="block size-14 overflow-hidden rounded-2xl ring-2 ring-white/40">
                  <ItemThumb item={i!} />
                </span>
              ))}
            </div>
          )}
          <button type="button" onClick={collect} disabled={claim.pending} className="mt-3 w-full rounded-2xl border-[3px] border-[#C21767] bg-primary py-3 font-spicy text-2xl text-white shadow-[0_6px_0_#C21767] active:translate-y-[4px] active:shadow-[0_2px_0_#C21767]">
            {claim.pending ? 'Collecting…' : 'Collect my rewards'}
          </button>
        </div>
      </div>
    </div>
  )
}
