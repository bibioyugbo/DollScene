import { memo, useRef, useState } from 'react'
import { clockTime, cx } from '../../lib/ui'
import type { AvatarSummary, MessageDoc } from '../../shared/types'
import { DollFigure } from '../art/DollFigure'
import { Icon } from '../Icon'

export type LocalStatus = 'sending' | 'failed'
export type ChatMessage = MessageDoc & { local?: LocalStatus }

export const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👏']

function Ticks({ m, other }: { m: ChatMessage; other: string }) {
  if (m.local === 'sending') return <Icon name="settings" className="size-3 animate-spin opacity-70" label="Sending" />
  if (m.local === 'failed') return <span className="text-[11px] font-bold">Failed</span>
  const read = m.readBy.includes(other)
  const delivered = read || m.deliveredTo.includes(other)
  return (
    <span aria-label={read ? 'Read' : delivered ? 'Delivered' : 'Sent'} className={cx('inline-flex', read ? 'text-[#7CF0CF]' : 'opacity-75')}>
      <svg viewBox="0 0 24 16" className="h-3 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M1 8l4 4 8-9" />
        {delivered && <path d="M10 12l1 0 8-9" />}
      </svg>
    </span>
  )
}

interface Props {
  m: ChatMessage
  me: string
  other: string
  otherName: string
  otherAvatar: AvatarSummary
  highlight: boolean
  onReply: (m: ChatMessage) => void
  onJump: (id: string) => void
  onReact: (m: ChatMessage, emoji: string | null) => void
  onDelete: (m: ChatMessage) => void
  onReport: (m: ChatMessage) => void
  onRetry: (m: ChatMessage) => void
}

/** One message: swipe right to reply, long-press for reactions and actions. */
export const MessageBubble = memo(function MessageBubble({ m, me, other, otherName, otherAvatar, highlight, onReply, onJump, onReact, onDelete, onReport, onRetry }: Props) {
  const mine = m.senderId === me
  const [dx, setDx] = useState(0)
  const [menu, setMenu] = useState(false)
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const press = useRef<number | null>(null)

  const reactions = Object.entries(m.reactions ?? {}).reduce<Record<string, number>>((acc, [, e]) => ((acc[e] = (acc[e] ?? 0) + 1), acc), {})
  const myReaction = m.reactions?.[me]

  const body = m.deletedForAll ? (
    <span className="italic opacity-70">Message deleted</span>
  ) : m.type === 'voice' || m.type === 'image' ? (
    <span className="italic opacity-75">Attachment no longer supported. Messages are text only.</span>
  ) : m.type === 'look' && m.look ? (
    <div className="flex w-56 flex-col gap-2">
      <div className="grid h-52 place-items-center rounded-2xl bg-white/90">
        <DollFigure avatar={m.look.avatar ?? otherAvatar} outfit={m.look.outfit} className="h-48 w-auto" />
      </div>
      <span className="text-sm">
        <span className="font-semibold">{m.look.name}’s look:</span> {m.look.summary}
      </span>
    </div>
  ) : (
    <span className="break-words whitespace-pre-wrap">{m.text}</span>
  )

  return (
    <div
      className={cx('group flex px-3 py-0.5', mine ? 'justify-end' : 'justify-start')}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
        press.current = window.setTimeout(() => !m.deletedForAll && setMenu(true), 480)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        const x = e.clientX - start.current.x
        if ((Math.abs(e.clientY - start.current.y) > 12 || Math.abs(x) > 8) && press.current) window.clearTimeout(press.current)
        if (x > 0 && Math.abs(e.clientY - start.current.y) < 30) setDx(Math.min(80, x))
      }}
      onPointerUp={() => {
        if (press.current) window.clearTimeout(press.current)
        if (dx > 56 && !m.deletedForAll) onReply(m)
        setDx(0)
        start.current = null
      }}
      onPointerCancel={() => {
        if (press.current) window.clearTimeout(press.current)
        setDx(0)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (!m.deletedForAll) setMenu(true)
      }}
    >
      <div className="relative max-w-[82%]" style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .2s' }}>
        {dx > 20 && (
          <span className="absolute top-1/2 -left-9 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-muted" style={{ opacity: dx / 56 }}>
            <Icon name="reply" className="size-4" />
          </span>
        )}
        <div
          className={cx(
            'rounded-3xl px-3.5 py-2 text-[15px] shadow-sm transition-shadow',
            mine ? 'rounded-br-lg bg-primary text-primary-foreground' : 'rounded-bl-lg bg-card text-foreground ring-1 ring-border',
            highlight && 'ring-4 ring-gold',
          )}
        >
          {m.replyTo && !m.deletedForAll && (
            <button
              type="button"
              onClick={() => onJump(m.replyTo!.id)}
              className={cx('mb-1.5 block w-full rounded-xl border-l-4 px-2 py-1 text-left text-xs', mine ? 'border-white/70 bg-white/20' : 'border-primary bg-muted')}
            >
              <span className="block font-semibold">{m.replyTo.senderId === me ? 'You' : m.replyTo.senderName}</span>
              <span className="line-clamp-2 opacity-80">{m.replyTo.type === 'look' ? '👗 Look' : m.replyTo.text}</span>
            </button>
          )}
          {body}
          <span className={cx('mt-0.5 flex items-center justify-end gap-1 text-[11px]', mine ? 'opacity-85' : 'text-muted-foreground')}>
            {clockTime(m.createdAt)}
            {mine && <Ticks m={m} other={other} />}
          </span>
        </div>
        {Object.keys(reactions).length > 0 && (
          <div className={cx('-mt-2 flex gap-0.5', mine ? 'justify-end pr-2' : 'pl-2')}>
            {Object.entries(reactions).map(([e, n]) => (
              <button key={e} type="button" onClick={() => onReact(m, myReaction === e ? null : e)} className={cx('rounded-full border bg-card px-1.5 text-xs shadow-sm', myReaction === e ? 'border-primary' : 'border-border')}>
                {e}
                {n > 1 ? ` ${n}` : ''}
              </button>
            ))}
          </div>
        )}
        {m.local === 'failed' && (
          <button type="button" onClick={() => onRetry(m)} className="mt-1 text-xs font-semibold text-[#B3123F] underline">
            Tap to retry
          </button>
        )}
        <button
          type="button"
          aria-label="Message options"
          onClick={() => setMenu(true)}
          className={cx('absolute top-1 hidden size-7 place-items-center rounded-full bg-muted opacity-0 group-hover:opacity-100 md:grid', mine ? '-left-9' : '-right-9')}
        >
          <Icon name="more" className="size-4" />
        </button>
        {menu && (
          <>
            <button type="button" aria-label="Close menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(false)} />
            <div role="menu" className={cx('absolute z-50 mt-1 w-56 rounded-2xl border border-border bg-card p-2 text-foreground shadow-xl', mine ? 'right-0' : 'left-0')}>
              <div className="mb-1 flex justify-between">
                {REACTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="menuitem"
                    aria-label={`React ${e}`}
                    onClick={() => {
                      onReact(m, myReaction === e ? null : e)
                      setMenu(false)
                    }}
                    className={cx('grid size-8 place-items-center rounded-full text-lg hover:bg-muted', myReaction === e && 'bg-primary/20')}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm hover:bg-muted" onClick={() => (onReply(m), setMenu(false))}>
                <Icon name="reply" className="size-4" /> Reply
              </button>
              {m.type === 'text' && (
                <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm hover:bg-muted" onClick={() => (void navigator.clipboard?.writeText(m.text), setMenu(false))}>
                  <Icon name="share" className="size-4" /> Copy
                </button>
              )}
              {mine ? (
                <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm text-[#B3123F] hover:bg-muted" onClick={() => (onDelete(m), setMenu(false))}>
                  <Icon name="trash" className="size-4" /> Delete for everyone
                </button>
              ) : (
                <button type="button" role="menuitem" className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm text-[#B3123F] hover:bg-muted" onClick={() => (onReport(m), setMenu(false))}>
                  <Icon name="flag" className="size-4" /> Report {otherName}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
})
