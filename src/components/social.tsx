import { useState } from 'react'
import { useNavigate } from 'react-router'
import { runAction, useAction } from '../hooks/useAction'
import { useDoc } from '../hooks/useData'
import { buttonClass, cx, inputClass } from '../lib/ui'
import { NOTE_MAX_CHARS } from '../shared/economy'
import { P } from '../shared/paths'
import type { FriendRequestDoc, ReportTarget } from '../shared/types'
import { useSession } from '../store/useSession'
import { toast } from '../store/useToasts'
import { Icon } from './Icon'
import { Modal } from './Modal'

export type Relationship = 'self' | 'friends' | 'requested' | 'incoming' | 'blocked' | 'none'

export function useRelationship(other: string | null | undefined): Relationship {
  const me = useSession((s) => s.user?.uid)
  const friends = useSession((s) => s.friendUids)
  const blocked = useSession((s) => s.blockedUids)
  const out = useDoc<FriendRequestDoc>(me && other && me !== other ? P.friendRequest(me, other) : null)
  const inc = useDoc<FriendRequestDoc>(me && other && me !== other ? P.friendRequest(other, me) : null)
  if (!other || !me) return 'none'
  if (other === me) return 'self'
  if (blocked.includes(other)) return 'blocked'
  if (friends.includes(other)) return 'friends'
  if (inc.data?.status === 'pending') return 'incoming'
  if (out.data?.status === 'pending') return 'requested'
  return 'none'
}

export function useOpenChat() {
  const navigate = useNavigate()
  return async (other: string) => {
    const res = await runAction('openConversation', { with: other })
    if (res) navigate(`/friends/chat/${res.id}`)
  }
}

export function FriendRequestDialog({ open, onClose, to, name }: { open: boolean; onClose: () => void; to: string; name: string }) {
  const [note, setNote] = useState('')
  const { run, pending } = useAction('sendFriendRequest')
  return (
    <Modal open={open} onClose={onClose} title={`Add ${name}`}>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-semibold">Say hi (optional)</span>
          <textarea value={note} maxLength={NOTE_MAX_CHARS} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Loved your gele at the party!" className={cx(inputClass, 'py-3')} />
          <span className="text-right text-xs text-muted-foreground">
            {note.length}/{NOTE_MAX_CHARS}
          </span>
        </label>
        <button
          type="button"
          className={buttonClass('primary', 'lg', 'w-full')}
          disabled={pending}
          onClick={async () => {
            const res = await run({ to, note })
            if (res) {
              toast.success(res.status === 'accepted' ? `You and ${name} are now friends` : `Request sent to ${name}`)
              setNote('')
              onClose()
            }
          }}
        >
          Send request
        </button>
      </div>
    </Modal>
  )
}

const REASONS = ['Harassment or bullying', 'Hate speech', 'Sexual content', 'Spam or scam', 'Impersonation', 'Underage user', 'Something else']

export function ReportDialog({
  open,
  onClose,
  targetType,
  targetId,
  targetUid,
  name,
}: {
  open: boolean
  onClose: () => void
  targetType: ReportTarget
  targetId: string
  targetUid: string
  name: string
}) {
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const { run, pending } = useAction('report')
  return (
    <Modal open={open} onClose={onClose} title={`Report ${name}`}>
      <div className="flex flex-col gap-3">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-semibold">What’s wrong?</legend>
          {REASONS.map((r) => (
            <label key={r} className="flex min-h-11 items-center gap-3 rounded-2xl px-2 hover:bg-muted">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-5 accent-[var(--primary)]" />
              {r}
            </label>
          ))}
        </fieldset>
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} placeholder="Anything that helps our moderators (optional)" className={cx(inputClass, 'py-3')} />
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="size-5 accent-[var(--primary)]" />
          Also block {name}
        </label>
        <button
          type="button"
          className={buttonClass('danger', 'lg', 'w-full')}
          disabled={pending}
          onClick={async () => {
            const ok = await run({ targetType, targetId, targetUid, reason, details })
            if (ok && alsoBlock) await runAction('block', { uid: targetUid })
            if (ok) {
              toast.success('Thanks. Our team will review this.')
              onClose()
            }
          }}
        >
          Send report
        </button>
      </div>
    </Modal>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  danger,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-muted-foreground">{body}</p>
      <div className="mt-5 flex gap-3">
        <button type="button" className={buttonClass('secondary', 'lg', 'flex-1')} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          className={buttonClass(danger ? 'danger' : 'primary', 'lg', 'flex-1')}
          onClick={async () => {
            setBusy(true)
            await onConfirm()
            setBusy(false)
            onClose()
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

/** Add friend / accept / message buttons for a doll. */
export function SocialButtons({ uid, name, compact, hideMessage, onNeedAuth }: { uid: string; name: string; compact?: boolean; hideMessage?: boolean; onNeedAuth?: () => void }) {
  const signedIn = useSession((s) => s.status === 'signed-in' && !!s.profile?.onboarded)
  const rel = useRelationship(uid)
  const openChat = useOpenChat()
  const [reqOpen, setReqOpen] = useState(false)
  const accept = useAction('respondFriendRequest')
  const size = compact ? 'md' : 'lg'
  const guard = (fn: () => void) => () => (signedIn ? fn() : onNeedAuth?.())

  if (rel === 'self') return null
  return (
    <>
      {rel === 'incoming' ? (
        <button type="button" className={buttonClass('primary', size, 'flex-1')} disabled={accept.pending} onClick={() => accept.run({ from: uid, action: 'accept' })}>
          <Icon name="check" /> Accept
        </button>
      ) : rel === 'friends' ? (
        <span className={buttonClass('secondary', size, 'flex-1 pointer-events-none')}>
          <Icon name="check" /> Friends
        </span>
      ) : rel === 'requested' ? (
        <button type="button" className={buttonClass('secondary', size, 'flex-1')} onClick={() => runAction('cancelFriendRequest', { to: uid })}>
          Requested
        </button>
      ) : rel === 'blocked' ? (
        <button type="button" className={buttonClass('secondary', size, 'flex-1')} onClick={() => runAction('unblock', { uid })}>
          Unblock
        </button>
      ) : (
        <button type="button" className={buttonClass('primary', size, 'flex-1')} onClick={guard(() => setReqOpen(true))}>
          <Icon name="plus" /> Add friend
        </button>
      )}
      {rel !== 'blocked' && !hideMessage && (
        <button type="button" className={buttonClass('secondary', size, 'flex-1')} onClick={guard(() => openChat(uid))}>
          <Icon name="chat" /> Message
        </button>
      )}
      {signedIn && <FriendRequestDialog open={reqOpen} onClose={() => setReqOpen(false)} to={uid} name={name} />}
    </>
  )
}
