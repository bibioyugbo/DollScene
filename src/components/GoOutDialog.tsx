import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAction } from '../hooks/useAction'
import { buttonClass, cx } from '../lib/ui'
import { PLACE_BY_ID, PLACES } from '../shared/places'
import type { PublicDoll } from '../shared/types'
import { toast } from '../store/useToasts'
import { Modal } from './Modal'
import { useLevel } from '../hooks/useLevel'
import { SOCIAL_UNLOCK_LEVEL } from '../shared/levels'

/** Pick a Lagos spot and the vibe, then send the invite. */
export function GoOutDialog({ friend, onClose, place: initialPlace }: { friend: PublicDoll; onClose: () => void; place?: string }) {
  const navigate = useNavigate()
  const spots = PLACES.filter((p) => p.dates)
  const [place, setPlace] = useState(initialPlace && PLACE_BY_ID.get(initialPlace)?.dates ? initialPlace : spots[0].id)
  const [kind, setKind] = useState<'friendship' | 'romantic'>('friendship')
  const invite = useAction('inviteOuting')
  const lvl = useLevel()
  return (
    <Modal open onClose={onClose} title={`Go out with ${friend.name}`}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Kind of date">
          {(['friendship', 'romantic'] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cx('rounded-2xl border-2 p-3 text-left', kind === k ? 'border-primary bg-primary/10' : 'border-border')}>
              <span className="block text-xl">{k === 'romantic' ? '💘' : '👯'}</span>
              <span className="block font-semibold capitalize">{k} date</span>
            </button>
          ))}
        </div>
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto" role="radiogroup" aria-label="Where">
          {spots.map((p) => (
            <li key={p.id}>
              <button type="button" role="radio" aria-checked={place === p.id} onClick={() => setPlace(p.id)} className={cx('flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left', place === p.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted')}>
                <span className="size-3 shrink-0 rounded-full" style={{ background: p.color }} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.area} · {p.blurb}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!lvl.social && (
          <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
            🔒 Dates unlock at <b>level {SOCIAL_UNLOCK_LEVEL}</b>. You’re level {lvl.level}: earn Glam at work, on the runway and from missions to level up.
          </p>
        )}
        <button
          type="button"
          className={buttonClass('primary', 'lg', 'w-full')}
          disabled={invite.pending || !lvl.social}
          onClick={async () => {
            const r = await invite.run({ to: friend.uid, place, kind })
            if (!r) return
            onClose()
            if (r.status === 'accepted') {
              toast.success(`${friend.name} said yes!`)
              navigate(`/dollscene?place=${place}&with=${friend.uid}`)
            } else toast.success(`Invite sent to ${friend.name}`)
          }}
        >
          Send invite
        </button>
      </div>
    </Modal>
  )
}
