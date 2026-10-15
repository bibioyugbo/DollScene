import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { realtime, useRealtime, type Peer } from '../net/realtime'
import { useStudio } from '../state/store'
import { Icon } from './icons'
import { click } from './sound'

/**
 * Scene chat. Everything said shows as a speech bubble over the speaker's head (and in this short
 * log). Typing with no one selected talks to the whole scene; tapping a person (their doll or
 * their name) points your messages at them: "To @name" sits on the chat bar, the message is tagged
 * and pings them wherever they are. Every player can be muted (hidden for you), blocked (neither
 * of you sees the other) or reported (logged for review, and blocked for you), from the ⋯ on the tag.
 */

/** Which player's safety menu is open (mute, block, report). */
export const usePeerMenu = create<{ peer: { id: string; name: string } | null }>(() => ({ peer: null }))
/** Who your messages are directed at (null: everyone). */
export const useChatTo = create<{ to: { id: string; name: string } | null }>(() => ({ to: null }))
/** A tap on a person: direct the next messages at them. */
export const openPeer = (peer: { id: string; name: string }) => {
  click('select')
  useChatTo.setState({ to: peer })
  window.dispatchEvent(new CustomEvent('ds-chat-focus'))
}

const REASONS = ['Harassment or bullying', 'Hate or slurs', 'Sexual content', 'Spam', 'Something else']

export function PeerMenu({ peer, onClose, onMention }: { peer: { id: string; name: string }; onClose: () => void; onMention: (name: string) => void }) {
  const muted = useRealtime((s) => s.muted.includes(peer.id))
  const [reporting, setReporting] = useState(false)
  const notify = useStudio((s) => s.notify)
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-end bg-black/30 p-3 sm:place-items-center" onClick={onClose}>
      <div role="dialog" aria-label={`${peer.name}`} className="ds-pop w-full max-w-xs rounded-[26px] bg-[#1c1220]/95 p-3 text-white shadow-2xl backdrop-blur" onClick={(e) => e.stopPropagation()}>
        <p className="px-2 pb-2 text-[18px] font-black">{peer.name}</p>
        {!reporting ? (
          <div className="flex flex-col gap-1.5">
            <button type="button" className="flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold" onClick={() => (onMention(peer.name), onClose())}>
              <Icon name="chat" className="h-4 w-4" /> Mention @{peer.name}
            </button>
            <button type="button" className="flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold" onClick={() => (realtime.mute(peer.id, !muted), notify(muted ? `${peer.name} unmuted.` : `${peer.name} muted: you won’t see their messages.`), onClose())}>
              <Icon name="mute" className="h-4 w-4" /> {muted ? 'Unmute' : 'Mute'}
            </button>
            <button type="button" className="flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-bold" onClick={() => (realtime.block(peer.id, true), notify(`${peer.name} blocked. You won’t see each other.`), onClose())}>
              <Icon name="block" className="h-4 w-4" /> Block
            </button>
            <button type="button" className="flex min-h-11 items-center gap-2 rounded-full bg-[#ff5a7a]/25 px-4 text-[14px] font-bold text-[#ffd0dc]" onClick={() => setReporting(true)}>
              <Icon name="flag" className="h-4 w-4" /> Report
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="px-2 pb-1 text-[13px] text-white/80">What’s wrong?</p>
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="min-h-11 rounded-full bg-white/10 px-4 text-left text-[14px] font-bold"
                onClick={() => {
                  const last = [...useRealtime.getState().chat].reverse().find((m) => m.from === peer.id)
                  realtime.report(peer.id, r, last?.text ?? '')
                  notify(`Reported. ${peer.name} is blocked for you.`, 'success')
                  onClose()
                }}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function Chat({ onPeer }: { onPeer: (p: { id: string; name: string }) => void }) {
  const chat = useRealtime((s) => s.chat)
  const status = useRealtime((s) => s.status)
  const me = useRealtime((s) => s.me)
  const peers = useRealtime((s) => s.peers)
  const to = useChatTo((s) => s.to)
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const recent = chat.slice(-(open ? 30 : 3))
  // the person you're talking to left the scene: back to everyone
  useEffect(() => {
    if (to && !peers[to.id]) useChatTo.setState({ to: null })
  }, [to, peers])
  useEffect(() => {
    const fn = () => input.current?.focus()
    window.addEventListener('ds-chat-focus', fn)
    return () => window.removeEventListener('ds-chat-focus', fn)
  }, [])
  const send = () => {
    if (!text.trim()) return
    click('tap')
    // directed: tagged with their name (they're pinged); otherwise open to the whole scene
    realtime.say(to && !text.includes(`@${to.name}`) ? `@${to.name} ${text}` : text)
    setText('')
  }
  // a tap on "@name" (or a name) starts a reply
  const mention = (name: string) => {
    setText((t) => (t.includes(`@${name}`) ? t : `@${name} ${t}`.trimEnd() + ' '))
    input.current?.focus()
  }
  useEffect(() => {
    const fn = (e: Event) => mention((e as CustomEvent<string>).detail)
    window.addEventListener('ds-mention', fn)
    return () => window.removeEventListener('ds-mention', fn)
  }, [])
  const here = Object.keys(peers).length
  return (
    <div className="pointer-events-auto flex w-full max-w-md flex-col gap-1.5">
      <div className={`flex flex-col gap-1 ${open ? 'ds-scroll-y max-h-[30dvh] rounded-2xl bg-black/45 p-2 backdrop-blur' : ''}`} aria-live="polite">
        {recent.map((m) => (
          <p key={m.id} className={`text-[13px] leading-snug text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.9)] ${m.pending ? 'opacity-60' : ''} ${m.forMe ? 'rounded-lg bg-[#ff8fb1]/30 px-1.5' : ''}`}>
            <button type="button" className="font-black text-[#ffd1e6]" onClick={() => (m.from === me ? null : openPeer({ id: m.from, name: m.name }))}>
              {m.name}
            </button>{' '}
            {m.text.split(/(@[\p{L}\p{N}_.'-]{1,24})/u).map((part, i) =>
              part.startsWith('@') ? (
                <span key={i} className="font-black text-[#ffe08a]">
                  {part}
                </span>
              ) : (
                <span key={i}>{part}</span>
              ),
            )}
          </p>
        ))}
      </div>
      {to && (
        <div className="flex items-center gap-1 self-start rounded-full bg-[#ff8fb1] py-0.5 pl-3 pr-1 text-[13px] font-extrabold text-[#2a0a18] shadow-lg">
          To @{to.name}
          <button type="button" aria-label={`Options for ${to.name}`} onClick={() => onPeer(to)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/10">
            ⋯
          </button>
          <button type="button" aria-label="Talk to everyone" onClick={() => (click('tap'), useChatTo.setState({ to: null }))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-black/10">
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={open ? 'Hide chat log' : 'Show chat log'} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="ds-fab relative grid h-11 w-11 shrink-0 place-items-center rounded-full">
          <Icon name="chat" className="h-[18px] w-[18px]" />
          {here > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-accent px-1.5 text-[10px] font-black text-accent-ink">{here + 1}</span>}
        </button>
        <input
          ref={input}
          value={text}
          maxLength={200}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={status === 'live' ? (to ? `Message @${to.name}…` : 'Say something to everyone…') : status === 'connecting' ? 'Connecting to chat…' : 'Chat is offline'}
          disabled={status !== 'live'}
          aria-label={to ? `Message to ${to.name}` : 'Chat message to everyone'}
          className="h-11 min-w-0 flex-1 rounded-full bg-white/95 px-4 text-[14px] font-semibold text-[#1c1220] shadow-lg placeholder:text-[#1c1220]/45 disabled:opacity-60"
        />
        <button type="button" aria-label="Send" onClick={send} disabled={!text.trim() || status !== 'live'} className="ds-cta grid h-11 w-11 shrink-0 place-items-center rounded-full disabled:opacity-40">
          <Icon name="send" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>
  )
}

export type { Peer }
