import { useEffect, useRef, useState } from 'react'
import { addPhoto, download } from '../photos'
import { SCENE_BY_ID, type SceneId } from '../scenes'
import { saveLook } from '../session'
import { takePhoto } from '../stage/capture'
import { EXPRESSION_PRESETS, POSES, useStudio, type ExpressionPreset, type PoseId } from '../state/store'
import { Chips } from './controls'
import { Icon } from './icons'
import { sceneLabel } from './ScenePicker'
import { ACTIVITIES, type Activity } from './activities'
import { Chat, PeerMenu, usePeerMenu } from './Chat'
import { myActivity } from '../net/RealtimeSync'
import { haptic, sfx } from './sound'

const POSE_NAMES: Record<PoseId, string> = { relaxed: 'Relaxed', 'hand-on-hip': 'Hand on hip', 'hands-on-hips': 'Hands on hips', wave: 'Wave', peace: 'Peace sign', 'blow-kiss': 'Blow a kiss', selfie: 'Selfie', thinking: 'Thinking', 'hair-touch': 'Hair touch', 'arms-crossed': 'Arms crossed', 'hands-clasped': 'Hands clasped' }
const EXPR_NAMES: Record<ExpressionPreset, string> = { neutral: 'Neutral', smile: 'Smile', laugh: 'Laugh', kiss: 'Kiss', wink: 'Wink', surprised: 'Surprised', sad: 'Sad', soft: 'Soft', pout: 'Pout' }

/**
 * Make a Scene: the doll at the event. Drag to orbit, pinch/scroll to zoom, pick a photo spot,
 * a pose and an expression, hide the UI and take a picture of the real render.
 */
export function EventView({ onBackToStudio, onChangeScene, onOutfit }: { onBackToStudio: () => void; onChangeScene: () => void; onOutfit: () => void }) {
  const look = useStudio((s) => s.look)
  const photo = useStudio((s) => s.photo)
  const setPhoto = useStudio((s) => s.setPhoto)
  const setFraming = useStudio((s) => s.setFraming)
  const framing = useStudio((s) => s.framing)
  const apply = useStudio((s) => s.apply)
  const notify = useStudio((s) => s.notify)
  const [hidden, setHidden] = useState(false)
  const [tab, setTab] = useState<'pose' | 'face' | 'do' | 'spot' | 'camera'>('do')
  const peerMenu = usePeerMenu((s) => s.peer)
  const [activity, setActivity] = useState<Activity | null>(null)
  const loopT = useRef(0)
  const [flash, setFlash] = useState(false)
  const [last, setLast] = useState<{ url: string; blob: Blob } | null>(null)
  const def = SCENE_BY_ID[look.scene.id as SceneId]
  const acts = ACTIVITIES[look.scene.id as SceneId] ?? []

  // an activity with a loop (dancing) steps through its poses until another pose is picked
  useEffect(() => {
    myActivity.act = activity?.id ?? ''
    if (!activity?.loop) return
    const { poses, every } = activity.loop
    const t = window.setInterval(() => {
      loopT.current = (loopT.current + 1) % poses.length
      setPhoto({ pose: poses[loopT.current] })
    }, every * 1000)
    return () => window.clearInterval(t)
  }, [activity, setPhoto])
  useEffect(() => () => void (myActivity.act = ''), [])
  const doActivity = (a: Activity) => {
    haptic(10)
    if (a.sfx) sfx(a.sfx)
    loopT.current = 0
    setActivity(a)
    setPhoto({ pose: a.pose, expression: a.expr })
  }

  const shoot = async () => {
    setHidden(true)
    // let the DOM hide before the frame is read (the UI is never in the WebGL frame anyway)
    await new Promise((r) => requestAnimationFrame(() => r(null)))
    try {
      const blob = await takePhoto()
      setFlash(true)
      window.setTimeout(() => setFlash(false), 180)
      const { stored } = await addPhoto(blob, def?.name ?? 'DollScene')
      setLast((prev) => {
        if (prev) URL.revokeObjectURL(prev.url)
        return { url: URL.createObjectURL(blob), blob }
      })
      notify(stored ? 'Snapped! Saved to your photos.' : 'Snapped! Download it: this device’s gallery is full or blocked.', stored ? 'success' : 'info')
    } catch (e) {
      console.error(e)
      notify('That photo didn’t come out. Try again.', 'error')
    } finally {
      setHidden(false)
    }
  }

  if (hidden)
    return (
      <button type="button" onClick={() => setHidden(false)} className="pointer-events-auto absolute bottom-[max(env(safe-area-inset-bottom),16px)] right-4 z-30 ds-fab grid h-12 w-12 place-items-center rounded-full" aria-label="Show controls">
        <Icon name="eye" />
      </button>
    )

  return (
    <>
      {flash && <div className="pointer-events-none absolute inset-0 z-40 bg-white/80" aria-hidden />}
      {peerMenu && <PeerMenu peer={peerMenu} onClose={() => usePeerMenu.setState({ peer: null })} onMention={(n) => window.dispatchEvent(new CustomEvent('ds-mention', { detail: n }))} />}
      <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <button type="button" onClick={onBackToStudio} className="ds-fab flex min-h-11 items-center gap-1.5 rounded-full pl-2.5 pr-4 text-[13px]">
          <Icon name="back" className="h-4 w-4" />
          Hub
        </button>
        <button type="button" onClick={onOutfit} className="ds-fab hidden min-h-11 rounded-full px-3.5 text-[12px] font-bold sm:block">
          Change outfit
        </button>
        <button type="button" onClick={onChangeScene} className="ds-fab flex min-h-11 min-w-0 items-center gap-2 rounded-full px-4 text-[13px]">
          <Icon name="scene" className="h-4 w-4 shrink-0 text-accent" />
          <span className="truncate">{sceneLabel(look.scene)}</span>
        </button>
        <span className="flex-1" />
        <button type="button" onClick={() => setHidden(true)} className="ds-fab grid h-11 w-11 place-items-center rounded-full" aria-label="Hide controls">
          <Icon name="eyeOff" />
        </button>
      </header>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 px-3 pb-[max(env(safe-area-inset-bottom),12px)]">
        {last && (
          <div className="ds-pop flex items-center gap-3">
            <img src={last.url} alt="Your latest photo" className="h-14 w-11 rounded-lg object-cover" />
            <button type="button" onClick={() => download(last.blob, `dollscene-${look.scene.id}-${Date.now()}.png`)} className="flex min-h-10 items-center gap-1.5 rounded-full bg-text px-3.5 text-[12px] font-semibold text-ink">
              <Icon name="download" className="h-4 w-4" /> Save image
            </button>
            <button type="button" onClick={() => saveLook(`${def?.name ?? 'Night out'} look`)} className="flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-[12px]">
              <Icon name="heart" className="h-4 w-4" /> Save look
            </button>
          </div>
        )}
        <div className="w-full max-w-xl p-1 [&_[role=radio]]:shadow-[0_4px_0_rgb(0_0_0/0.25)] [&_[role=radio][aria-checked=false]]:bg-black/45 [&_[role=radio][aria-checked=false]]:text-white [&_[role=radio][aria-checked=false]]:backdrop-blur [&_[role=radio][aria-checked=false]]:border-transparent">
          <div className="mb-2 flex items-center gap-2">
            <Chips
              label="Photo controls"
              value={tab}
              onPick={setTab}
              options={[
                { id: 'do', name: 'Do' },
                { id: 'pose', name: 'Pose' },
                { id: 'face', name: 'Expression' },
                { id: 'spot', name: 'Spot' },
                { id: 'camera', name: 'Camera' },
              ]}
            />
          </div>
          {tab === 'do' && <Chips label="Activities" value={activity?.id ?? null} onPick={(id) => doActivity(acts.find((a) => a.id === id)!)} options={acts.map((a) => ({ id: a.id, name: `${a.emoji} ${a.label}` }))} />}
          {tab === 'pose' && <Chips label="Pose" value={photo.pose} onPick={(pose) => (setActivity(null), setPhoto({ pose }))} options={POSES.map((p) => ({ id: p, name: POSE_NAMES[p] }))} />}
          {tab === 'face' && <Chips label="Expression" value={photo.expression} onPick={(expression) => setPhoto({ expression })} options={EXPRESSION_PRESETS.map((p) => ({ id: p, name: EXPR_NAMES[p] }))} />}
          {tab === 'spot' && def && (
            <Chips
              label="Photo spot"
              value={look.scene.spot || def.photoSpots[0]?.id}
              onPick={(spot) => {
                apply((l) => void (l.scene.spot = spot))
                setPhoto({ yaw: 0 })
              }}
              options={def.photoSpots.map((s) => ({ id: s.id, name: s.name }))}
            />
          )}
          {tab === 'camera' && (
            <div className="flex flex-wrap items-center gap-2">
              <Chips
                label="Framing"
                value={framing === 'full' || framing === 'bust' ? framing : 'bust'}
                onPick={setFraming}
                options={[
                  { id: 'full', name: 'Full length' },
                  { id: 'bust', name: 'Portrait' },
                ]}
              />
              <button type="button" aria-label="Zoom in" onClick={() => setPhoto({ zoom: Math.max(0.45, photo.zoom * 0.85) })} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                <Icon name="plus" className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Zoom out" onClick={() => setPhoto({ zoom: Math.min(2.2, photo.zoom * 1.18) })} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                <Icon name="minus" className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Turn the camera left" onClick={() => setPhoto({ yaw: photo.yaw + 0.35 })} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                <Icon name="back" className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Turn the camera right" onClick={() => setPhoto({ yaw: photo.yaw - 0.35 })} className="grid h-10 w-10 place-items-center rounded-full border border-line">
                <Icon name="next" className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setPhoto({ yaw: 0, pitch: 0.05, zoom: 1, lift: 0 })} className="min-h-10 rounded-full border border-line px-3 text-[12px]">
                Reset view
              </button>
            </div>
          )}
          <div className="mt-3 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Chat onPeer={(p) => usePeerMenu.setState({ peer: p })} />
            </div>
            <button type="button" onClick={shoot} aria-label="Take a photo" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-text text-ink shadow-xl ring-4 ring-white/30 active:scale-95">
              <Icon name="photo" className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
