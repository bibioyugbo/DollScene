import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { isOnline } from '../../app/SessionProvider'
import { DollAvatar } from '../art/DollAvatar'
import { MessageBubble, type ChatMessage } from './MessageBubble'
import { Icon } from '../Icon'
import { ConfirmDialog, ReportDialog } from '../social'
import { runAction, useAction } from '../../hooks/useAction'
import { useDoc, useQueryDocs } from '../../hooks/useData'
import { track } from '../../lib/analytics'
import { buttonClass, cx, timeAgo } from '../../lib/ui'
import { backend, friendlyError } from '../../services/backend'
import type { WriteOp } from '../../services/types'
import { outfitSummary } from '../../shared/appearance'
import { MESSAGE_MAX_CHARS } from '../../shared/economy'
import { arrayUnion, deleteField, inc } from '../../shared/fieldOps'
import { P } from '../../shared/paths'
import type { ConversationDoc, MessageDoc, MessageType, PublicDoll, ReplyRef } from '../../shared/types'
import { useSession } from '../../store/useSession'
import { toast } from '../../store/useToasts'

const PAGE = 30
const TYPING_TTL = 4000

function preview(m: Pick<MessageDoc, 'type' | 'text'>): string {
  return m.type === 'look' ? '👗 Shared a look' : m.type === 'voice' || m.type === 'image' ? 'Attachment' : m.text.slice(0, 120)
}

/** The whole conversation UI. `compact` fits it inside the flip phone's screen. */
export function ChatPanel({ cid, compact = false }: { cid: string; compact?: boolean }) {
  const navigate = useNavigate()
  const me = useSession((s) => s.user!.uid)
  const myPub = useSession((s) => s.publicDoll)
  const myDoll = useSession((s) => s.doll)
  const blocked = useSession((s) => s.blockedUids)
  const conv = useDoc<ConversationDoc>(P.conversation(cid))
  const other = conv.data?.members.find((m) => m !== me) ?? ''
  const otherPub = useDoc<PublicDoll>(other ? P.publicDoll(other) : null)
  const [limit, setLimit] = useState(PAGE)
  const live = useQueryDocs<MessageDoc>(conv.data ? P.messages(cid) : null, { orderBy: ['createdAt', 'desc'], limit })
  const [pending, setPending] = useState<ChatMessage[]>([])
  const [hasMore, setHasMore] = useState(true)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [jumpTarget, setJumpTarget] = useState<string | null>(null)
  const [report, setReport] = useState<ChatMessage | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [now, setNow] = useState(Date.now())
  const lastTyping = useRef(0)
  const lastSend = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)
  const acceptReq = useAction('acceptMessageRequest')
  const db = backend().db

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // Live window + optimistic sends, oldest first.
  const messages = useMemo<ChatMessage[]>(() => {
    const ids = new Set(live.data.map((m) => m.id))
    const all: ChatMessage[] = [...live.data, ...pending.filter((p) => !ids.has(p.id))]
    return all.sort((a, b) => a.createdAt - b.createdAt)
  }, [live.data, pending])

  // Drop optimistic copies once the server has them.
  useEffect(() => {
    if (!pending.length) return
    const ids = new Set(live.data.map((m) => m.id))
    if (pending.some((p) => ids.has(p.id))) setPending((ps) => ps.filter((p) => !ids.has(p.id)))
  }, [live.data, pending])

  useEffect(() => {
    if (!live.loading && live.data.length < limit) setHasMore(false)
  }, [live.loading, live.data.length, limit])

  /* ------------------------------------------------------------ receipts */
  useEffect(() => {
    if (!conv.data || !other) return
    const incoming = live.data.filter((m) => m.senderId !== me)
    const ops: WriteOp[] = []
    const visible = document.visibilityState === 'visible'
    for (const m of incoming) {
      const patch: Record<string, unknown> = {}
      if (!m.deliveredTo.includes(me)) patch.deliveredTo = arrayUnion(me)
      if (visible && !m.readBy.includes(me)) patch.readBy = arrayUnion(me)
      if (Object.keys(patch).length) ops.push({ type: 'update', path: P.message(cid, m.id), data: patch })
    }
    if (visible && (conv.data.unread?.[me] ?? 0) > 0) ops.push({ type: 'update', path: P.conversation(cid), data: { [`unread.${me}`]: 0 } })
    if (ops.length) db.write(ops.slice(0, 400)).catch(() => undefined)
  }, [live.data, conv.data, other, me, cid, db])

  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  /* ---------------------------------------------------------- virtual list */
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 76,
    overscan: 10,
    getItemKey: (i) => messages[i].id,
  })

  const atBottom = useRef(true)
  const prevCount = useRef(0)
  const anchor = useRef<{ id: string } | null>(null)

  useLayoutEffect(() => {
    const n = messages.length
    if (!n) return
    if (anchor.current) {
      // Older page arrived: keep the same message at the top.
      const idx = messages.findIndex((m) => m.id === anchor.current!.id)
      anchor.current = null
      if (idx > 0) virtualizer.scrollToIndex(idx, { align: 'start' })
    } else if (prevCount.current === 0 || (n > prevCount.current && (atBottom.current || messages[n - 1].senderId === me))) {
      virtualizer.scrollToIndex(n - 1, { align: 'end' })
      requestAnimationFrame(() => virtualizer.scrollToIndex(n - 1, { align: 'end' }))
    }
    prevCount.current = n
  }, [messages, virtualizer, me])

  const loadOlder = useCallback(() => {
    if (!hasMore || live.loading || !messages.length) return
    anchor.current = { id: messages[0].id }
    setLimit((l) => l + PAGE)
  }, [hasMore, live.loading, messages])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
    if (el.scrollTop < 200) loadOlder()
  }

  /* ---------------------------------------------------------- jump to reply */
  const jump = useCallback(
    (id: string) => {
      const idx = messages.findIndex((m) => m.id === id)
      if (idx >= 0) {
        virtualizer.scrollToIndex(idx, { align: 'center', behavior: 'smooth' })
        setHighlight(id)
        window.setTimeout(() => setHighlight(null), 1600)
        setJumpTarget(null)
      } else if (hasMore) {
        setJumpTarget(id)
        setLimit((l) => l + PAGE * 2)
      } else toast.info('That message is no longer available.')
    },
    [messages, virtualizer, hasMore],
  )
  useEffect(() => {
    if (jumpTarget && messages.some((m) => m.id === jumpTarget)) jump(jumpTarget)
  }, [jumpTarget, messages, jump])

  /* ------------------------------------------------------------- sending */
  const isRecipientOfRequest = conv.data?.status === 'request' && conv.data.requestedBy !== me
  const isBlocked = blocked.includes(other)
  const canSend = !!conv.data && !isRecipientOfRequest && !isBlocked

  const send = async (partial: Pick<MessageDoc, 'type'> & Partial<MessageDoc>) => {
    if (!conv.data || !canSend) return
    const t = Date.now()
    if (t - lastSend.current < 350) return
    lastSend.current = t
    const id = db.newId()
    const reply: ReplyRef | null = replyTo
      ? { id: replyTo.id, senderId: replyTo.senderId, senderName: replyTo.senderId === me ? myPub?.name ?? 'You' : otherPub.data?.name ?? '', type: replyTo.type, text: preview(replyTo) }
      : null
    const base: MessageDoc = {
      id,
      conversationId: cid,
      senderId: me,
      type: partial.type,
      text: partial.text ?? '',
      replyTo: reply,
      voice: null,
      look: partial.look ?? null,
      image: null,
      reactions: {},
      deletedForAll: false,
      deliveredTo: [],
      readBy: [],
      createdAt: t,
    }
    setReplyTo(null)
    setPending((ps) => [...ps, { ...base, local: 'sending' }])
    try {
      const msg: MessageDoc = base
      await db.write([
        { type: 'set', path: P.message(cid, id), data: msg },
        {
          type: 'update',
          path: P.conversation(cid),
          data: { lastMessage: { text: preview(msg), type: msg.type, senderId: me, createdAt: t }, updatedAt: t, [`unread.${other}`]: inc(1), [`typing.${me}`]: deleteField() },
        },
      ])
      track('message_sent', { type: msg.type })
      void runAction('track', { event: 'message' }, { silent: true })
    } catch (e) {
      setPending((ps) => ps.map((p) => (p.id === id ? { ...p, local: 'failed' } : p)))
      toast.error(friendlyError(e))
    }
  }

  const sendText = () => {
    const body = text.trim().slice(0, MESSAGE_MAX_CHARS)
    if (!body) return
    setText('')
    void send({ type: 'text', text: body })
  }

  const sendLook = () => {
    if (!myDoll || !myPub) return
    void send({ type: 'look', look: { name: myDoll.name, portrait: myPub.portrait, outfit: myDoll.appearance.outfit, summary: outfitSummary(myDoll.appearance.outfit), avatar: myPub.avatar } })
  }

  const onType = (v: string) => {
    setText(v)
    const t = Date.now()
    if (conv.data && canSend && t - lastTyping.current > 2500) {
      lastTyping.current = t
      db.write([{ type: 'update', path: P.conversation(cid), data: { [`typing.${me}`]: t } }]).catch(() => undefined)
    }
  }

  const react = useCallback(
    (m: ChatMessage, emoji: string | null) => {
      if (m.local) return
      db.write([{ type: 'update', path: P.message(cid, m.id), data: { [`reactions.${me}`]: emoji ?? deleteField() } }]).catch((e) => toast.error(friendlyError(e)))
    },
    [db, cid, me],
  )
  const del = useCallback(
    (m: ChatMessage) => {
      if (m.local) {
        setPending((ps) => ps.filter((p) => p.id !== m.id))
        return
      }
      if (!window.confirm('Delete this message for everyone?')) return
      db.write([{ type: 'update', path: P.message(cid, m.id), data: { deletedForAll: true, text: '', voice: null, look: null, image: null } }]).catch((e) => toast.error(friendlyError(e)))
    },
    [db, cid],
  )
  const retry = useCallback(
    (m: ChatMessage) => {
      setPending((ps) => ps.filter((p) => p.id !== m.id))
      void send({ type: m.type as MessageType, text: m.text, look: m.look ?? undefined })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conv.data, canSend],
  )
  const onReply = useCallback((m: ChatMessage) => setReplyTo(m), [])
  const onReport = useCallback((m: ChatMessage) => setReport(m), [])

  if (!conv.loading && !conv.data)
    return (
      <div className={cx('grid place-items-center bg-background p-6 text-center', compact ? 'h-full' : 'h-dvh')}>
        <div className="flex flex-col items-center gap-3">
          <p className="font-display text-xl font-bold">Chat not found</p>
          <Link to="/friends?tab=chats" className={buttonClass('primary', 'md')}>
            Back to chats
          </Link>
        </div>
      </div>
    )

  const o = otherPub.data
  const typing = !!conv.data && (conv.data.typing?.[other] ?? 0) > now - TYPING_TTL
  const name = o?.name ?? conv.data?.names[other] ?? '…'

  return (
    <div className={cx('flex flex-col bg-background text-foreground', compact ? 'h-full text-sm' : 'h-dvh')}>
      <header className={cx('flex shrink-0 items-center border-b border-border bg-card', compact ? 'gap-1.5 px-1.5 py-1' : 'gap-3 px-3 pt-safe pb-2 md:pt-3')}>
        <button type="button" aria-label="Back" onClick={() => navigate('/friends?tab=chats')} className="grid size-11 place-items-center rounded-full hover:bg-muted">
          <Icon name="back" />
        </button>
        <Link to={other ? `/u/${other}` : '#'} className="flex min-w-0 flex-1 items-center gap-3">
          <DollAvatar avatar={o?.avatar} portrait={o?.portrait} online={isOnline(o)} />
          <span className="min-w-0">
            <span className="block truncate font-semibold">{name}</span>
            <span className={cx('block truncate text-xs', typing ? 'font-semibold text-primary' : 'text-muted-foreground')} aria-live="polite">
              {typing ? 'typing…' : isOnline(o) ? 'online' : o ? `last seen ${timeAgo(o.lastActive)}` : ''}
            </span>
          </span>
        </Link>
        <button type="button" aria-label={`Report ${name}`} onClick={() => setReport({ id: other } as ChatMessage)} className="grid size-11 place-items-center rounded-full hover:bg-muted">
          <Icon name="flag" />
        </button>
        <button type="button" aria-label={`Block ${name}`} onClick={() => setBlockOpen(true)} className="grid size-11 place-items-center rounded-full hover:bg-muted">
          <Icon name="block" />
        </button>
      </header>

      {conv.data?.status === 'request' && (
        <div className="shrink-0 border-b border-border bg-primary/10 px-4 py-3 text-sm">
          {isRecipientOfRequest ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{name}</span> isn’t your friend yet and wants to message you.
              </span>
              <button type="button" className={buttonClass('primary', 'sm')} disabled={acceptReq.pending} onClick={() => acceptReq.run({ conversationId: cid })}>
                Accept
              </button>
              <button type="button" className={buttonClass('secondary', 'sm')} onClick={() => setBlockOpen(true)}>
                Block
              </button>
            </div>
          ) : (
            <span>Message request sent. {name} will see your messages in their requests inbox.</span>
          )}
        </div>
      )}

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2" role="log" aria-label={`Conversation with ${name}`} aria-live="polite">
        {hasMore && messages.length >= PAGE && (
          <div className="flex justify-center py-2">
            <button type="button" className={buttonClass('ghost', 'sm')} onClick={loadOlder}>
              Load earlier messages
            </button>
          </div>
        )}
        {!live.loading && !messages.length && <p className="px-6 py-10 text-center text-sm text-muted-foreground">Say hi to {name} 👋 Messages are text only. Tap the hanger to send your current look.</p>}
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((v) => {
            const m = messages[v.index]
            return (
              <div key={v.key} data-index={v.index} ref={virtualizer.measureElement} style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${v.start}px)` }}>
                <MessageBubble
                  m={m}
                  me={me}
                  other={other}
                  otherName={name}
                  otherAvatar={o?.avatar ?? myPub!.avatar}
                  highlight={highlight === m.id}
                  onReply={onReply}
                  onJump={jump}
                  onReact={react}
                  onDelete={del}
                  onReport={onReport}
                  onRetry={retry}
                />
              </div>
            )
          })}
        </div>
        {typing && (
          <div className="px-4 py-1" aria-hidden>
            <span className="inline-flex gap-1 rounded-full bg-card px-3 py-2 ring-1 ring-border">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </div>
        )}
      </div>

      <footer className={cx('shrink-0 border-t border-border bg-card', compact ? 'p-1.5' : 'px-2 pt-2 pb-safe')}>
        {replyTo && (
          <div className="mx-1 mb-2 flex items-center gap-2 rounded-2xl border-l-4 border-primary bg-muted px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Replying to {replyTo.senderId === me ? 'yourself' : name}</span>
              <span className="block truncate text-muted-foreground">{preview(replyTo)}</span>
            </span>
            <button type="button" aria-label="Cancel reply" onClick={() => setReplyTo(null)} className="grid size-8 place-items-center rounded-full hover:bg-border">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        )}
        {isBlocked ? (
          <p className="px-3 py-3 text-center text-sm text-muted-foreground">You blocked {name}. Unblock in Settings to chat.</p>
        ) : isRecipientOfRequest ? (
          <p className="px-3 py-3 text-center text-sm text-muted-foreground">Accept the request to reply.</p>
        ) : (
          <form
            className="flex items-end gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              sendText()
            }}
          >
            <button type="button" aria-label="Send my look" onClick={sendLook} className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-muted">
              <Icon name="hanger" />
            </button>
            <textarea
              value={text}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendText()
                }
              }}
              rows={1}
              maxLength={MESSAGE_MAX_CHARS}
              placeholder="Message"
              aria-label="Message"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-border bg-background px-4 py-2.5 text-base outline-none focus:border-primary"
            />
            <button type="submit" aria-label="Send" disabled={!text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
              <Icon name="send" />
            </button>
          </form>
        )}
      </footer>

      {report && (
        <ReportDialog
          open
          onClose={() => setReport(null)}
          targetType={report.senderId ? 'message' : 'profile'}
          targetId={report.senderId ? `${cid}/${report.id}` : other}
          targetUid={other}
          name={name}
        />
      )}
      <ConfirmDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        title={`Block ${name}?`}
        body="They won't be able to message you or send requests."
        confirmLabel="Block"
        danger
        onConfirm={async () => {
          await runAction('block', { uid: other })
          navigate('/friends?tab=chats')
        }}
      />
    </div>
  )
}
