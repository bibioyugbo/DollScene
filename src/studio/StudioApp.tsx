import { useGLTF, useTexture } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMediaQuery, useReducedMotion } from '../hooks/useMediaQuery'
import { cancelAction } from './actions/engine'
import { hasConditions, skinCheckIn } from './actions/skincare'
import { url, useCatalog, type CharacterCatalog } from './character/catalog'
import { applyShotParams, markShotReady } from './devShot'
import { realtime, useRealtime } from './net/realtime'
import { RealtimeSync } from './net/RealtimeSync'
import { preloadOther, preloadProgress, usePreload } from './preload'
import { DOOR_BY_ID, ROOMS, type DoorId, type RoomId } from './rooms'
import { SCENE_BY_ID, type SceneId } from './scenes'
import { flushSave, rescueLook, startSession } from './session'
import { lookToDoor, useHub } from './stage/Hub'
import { StudioStage, type Insets, type StageTheme } from './stage/StudioStage'
import { SkinHealer } from './state/healing'
import { useStudio } from './state/store'
import { Arrow3D } from './ui/Arrow3D'
import { Boot } from './ui/Boot'
import { openPeer } from './ui/Chat'
import { EventView } from './ui/EventView'
import { ConfirmDialog, installAsyncHandlers, Toasts } from './ui/feedback'
import { Icon } from './ui/icons'
import { PickDoll } from './ui/PickDoll'
import { ProfilePanel } from './panels/ProfilePanels'
import { ResultPop } from './ui/results'
import { RAIL_W, RoomUI, TILE_GRID_W } from './ui/rooms/RoomUI'
import { SceneSelect } from './ui/SceneSelect'
import { ActionHud } from './ui/StepCard'
import { click } from './ui/sound'
import { isFramed } from './vatar/sdk'

/** The doll picker: a soft slate-blue stage (portrait-studio feel). */
const PICK: StageTheme = { top: '#4a68a8', bottom: '#1b2850', glow: '#8fb0ff', floor: '#2c4178' }

/** Each room behind a Hub door has its own light and colour. */
const ROOM_THEME: Record<RoomId, StageTheme> = {
  makeup: { top: '#f6c9d6', bottom: '#5a2a3c', glow: '#fff1f5', floor: '#7a3e52' }, // vanity: blush and bulbs
  hair: { top: '#d9c8f2', bottom: '#2e2346', glow: '#ffffff', floor: '#4a3a6a' }, // salon: lilac
  skincare: { top: '#bfeee6', bottom: '#11393a', glow: '#f2fffd', floor: '#2a5a5a' }, // spa: aqua and steam
  doctor: { top: '#ebe4f7', bottom: '#3a3150', glow: '#ffffff', floor: '#5a5070' }, // clinic: clean lavender
  kai: { top: '#2a3a6a', bottom: '#0c1226', glow: '#ffd23f', floor: '#1b2340' },
  moncherrie: { top: '#f7c6d4', bottom: '#4a1e30', glow: '#ffe6ee', floor: '#6a2a42' },
  dopebyfabby: { top: '#1f6b55', bottom: '#06201a', glow: '#ffe6a0', floor: '#0e3a2e' },
  deeji: { top: '#3a4f9a', bottom: '#0f1430', glow: '#ffd38a', floor: '#1e2a5c' },
  bolaptsd: { top: '#3a1414', bottom: '#080606', glow: '#ff3b3b', floor: '#221010' },
}

const TOP_H = 60

/* ------------------------------------------------------------------ the Hub's 2D layer */

function HubUI({ wide, onChangeDoll, onProfile }: { wide: boolean; onChangeDoll: () => void; onProfile: () => void }) {
  const hovered = useHub((s) => s.hovered)
  const entering = useHub((s) => s.entering)
  const name = useStudio((s) => s.look.profile.name)
  const status = useRealtime((s) => s.status)
  const total = useRealtime((s) => s.counts.total)
  const d = hovered ? DOOR_BY_ID[hovered] : null
  if (entering) return null
  return (
    <>
      <header className="pointer-events-auto absolute inset-x-0 top-0 z-20 flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),10px)]">
        <div className="flex flex-col leading-none">
          <span className="text-[24px] font-black tracking-tight text-white drop-shadow">
            Doll<span className="text-[#ffd1e6]">Scene</span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/70">Beauty Studio</span>
        </div>
        <span className="flex-1" />
        <span className="rounded-full bg-black/50 px-3 py-1.5 text-[12px] font-bold text-white backdrop-blur" aria-live="polite">
          {status === 'live' ? `👥 ${total ?? 1} online` : status === 'connecting' ? 'Connecting…' : 'Offline'}
        </span>
        <button type="button" onClick={() => (click('tap'), onProfile())} aria-label="Lookbook, photos, challenges and shop" className="ds-fab grid h-10 w-10 place-items-center rounded-full">
          <Icon name="heart" className="h-[18px] w-[18px]" />
        </button>
        <button type="button" onClick={() => (click('tap'), onChangeDoll())} className="ds-fab flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold">
          <Icon name="profile" className="h-4 w-4" />
          {name || 'My doll'}
        </button>
      </header>
      <div className={`pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center gap-3 px-4 ${wide ? 'bottom-8' : 'bottom-[max(env(safe-area-inset-bottom),14px)]'}`}>
        <p className="min-h-[2.6em] text-center text-[15px] font-extrabold text-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.7)]">
          {d ? (
            <>
              {d.name}
              <span className="block text-[12px] font-bold text-white/75">{d.sub} · tap the door to go in</span>
            </>
          ) : (
            'Drag to look around · tap a door'
          )}
        </p>
        <div className="flex items-center gap-4">
          <Arrow3D dir="left" label="Look left" onClick={() => lookToDoor(-1)} />
          <Arrow3D dir="right" label="Look right" onClick={() => lookToDoor(1)} />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ app */

export default function StudioApp() {
  const { catalog, error: catalogError, retry: retryCatalog } = useCatalog()
  const wide = useMediaQuery('(min-width: 900px), (orientation: landscape) and (min-width: 720px)')
  const reduced = useReducedMotion()
  const phase = useStudio((s) => s.phase)
  const room = useStudio((s) => s.room)
  const paused = useStudio((s) => s.paused)
  const uiHidden = useStudio((s) => s.uiHidden)
  const ready = useStudio((s) => s.characterReady)
  const look = useStudio((s) => s.look)
  const pre = usePreload()
  const [sessionReady, setSessionReady] = useState(false)
  const [modelError, setModelError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [bootGone, setBootGone] = useState(false)
  const [sceneLoading, setSceneLoading] = useState(false)
  const [sceneReadyId, setSceneReadyId] = useState<string | null>(null)
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [profile, setProfile] = useState(false)
  /** The door's glow washing over the screen as you step through it. */
  const [wash, setWash] = useState<{ color: string; key: number } | null>(null)

  useEffect(() => {
    installAsyncHandlers()
    startSession()
      .then(applyShotParams)
      .catch((e) => {
        console.error(e)
        useStudio.getState().notify('Couldn’t reach your saved looks. Playing on this device for now.', 'error')
      })
      .finally(() => setSessionReady(true))
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // everything the next screens need starts downloading the moment we know what exists
  useEffect(() => {
    if (catalog) preloadOther(catalog)
  }, [catalog])

  // Fullscreen: Lagos Life's player already fills the phone and doesn't grant the Fullscreen API to
  // games; outside it (preview), the first tap asks the browser for real fullscreen.
  useEffect(() => {
    if (isFramed()) return
    const go = () => {
      document.removeEventListener('pointerdown', go)
      const el = document.documentElement
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {})
    }
    document.addEventListener('pointerdown', go)
    return () => document.removeEventListener('pointerdown', go)
  }, [])

  // Boot ends when the catalog, the session, the 3D doll and every preloaded asset are really ready.
  const bootError = catalogError ? 'DollScene couldn’t load. Check your connection.' : modelError ? 'Your doll couldn’t load. Check your connection.' : null
  useEffect(() => {
    if (phase === 'boot' && catalog && sessionReady && ready && pre.modulesReady && pre.otherReady && !bootError) {
      useStudio.getState().setPhase('onboard')
      useStudio.getState().setFraming('full')
      markShotReady()
    }
  }, [phase, catalog, sessionReady, ready, pre.modulesReady, pre.otherReady, bootError])

  const retry = () => {
    useGLTF.clear(url.body)
    useTexture.clear([url.mask('face_a'), url.mask('face_b'), url.mask('face_c'), url.mask('body')])
    setModelError(false)
    setAttempt((n) => n + 1)
    retryCatalog()
  }

  const goHub = useCallback(() => {
    cancelAction()
    useHub.setState({ entering: null, hovered: null })
    const s = useStudio.getState()
    s.setPhase('hub')
    s.setFraming('full')
  }, [])
  const goEvent = useCallback(() => {
    cancelAction()
    const s = useStudio.getState()
    s.setPhoto({ yaw: 0, pitch: 0.05, zoom: 1, lift: 0 })
    s.setFraming('full')
    if (s.phase !== 'scenes') setSceneLoading(true)
    s.setPhase('event')
  }, [])
  const goScenes = useCallback(() => {
    cancelAction()
    const s = useStudio.getState()
    s.setPhoto({ yaw: 0, pitch: 0.06, zoom: 1, lift: 0 })
    s.setFraming('full')
    s.setPhase('scenes')
  }, [])
  const throughDoor = useCallback(
    (id: DoorId) => {
      useHub.setState({ entering: null })
      setWash({ color: DOOR_BY_ID[id].glow, key: Date.now() })
      if (id === 'scenes') return goScenes()
      const r = DOOR_BY_ID[id].rooms[0]
      const s = useStudio.getState()
      if (r === 'skincare' && !hasConditions(s.look.care)) {
        // a new day at Skincare Bay: her own mix of skin issues to treat
        s.apply((l) => skinCheckIn(l, (Date.now() ^ (l.profile.name.length * 7919)) >>> 0))
      }
      s.enterRoom(r)
      s.markBefore()
    },
    [goScenes],
  )

  // H hides/shows the controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === 'h' || e.key === 'H') useStudio.setState((s) => ({ uiHidden: !s.uiHidden }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // server notices and @mentions reach the player wherever they are
  useEffect(
    () =>
      useRealtime.subscribe((s, p) => {
        if (s.notice && s.notice !== p.notice) {
          useStudio.getState().notify(s.notice, 'info')
          realtime.clearNotice()
        }
        const fresh = s.pings.length > p.pings.length ? s.pings[s.pings.length - 1] : null
        if (fresh && useStudio.getState().phase !== 'event') useStudio.getState().notify(`@ ${fresh.name}: ${fresh.text}`, 'info')
      }),
    [],
  )

  const insets: Insets = useMemo(() => {
    if (phase === 'hub') return { left: 0, right: 0, bottom: 0, top: 0 }
    if (phase === 'event') return { left: 0, right: 0, bottom: Math.min(size.h * 0.32, 250), top: 56 }
    if (uiHidden) return { left: 0, right: 0, bottom: 0, top: 0 }
    if (phase === 'onboard') return wide ? { left: 0, right: Math.min(size.w * 0.5, 640) + size.w * 0.03, bottom: 0, top: 0 } : { left: 0, right: 0, bottom: Math.min(size.h * 0.58, 500), top: 100 }
    if (phase === 'scenes') return wide ? { left: 0, right: 0, bottom: 330, top: 120 } : { left: 0, right: 0, bottom: Math.min(size.h * 0.46, 380), top: 150 }
    if (phase === 'studio') return wide ? { left: RAIL_W, right: TILE_GRID_W + 12, bottom: 0, top: TOP_H } : { left: RAIL_W * 0.6, right: 0, bottom: 2 * 120 + 56, top: TOP_H }
    return { left: 0, right: 0, bottom: 0, top: 0 }
  }, [phase, uiHidden, wide, size])

  const welcome = (name: string) => {
    const def = SCENE_BY_ID[look.scene.id as SceneId]
    useStudio.getState().notify(`Welcome, ${name}! ${def ? `${def.name} is buzzing.` : ''} Strike a pose.`, 'success')
  }

  const theme = phase === 'studio' && room ? ROOM_THEME[room] : PICK

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink">
      {catalog && (
        <StudioStage
          catalog={catalog}
          theme={theme}
          insets={insets}
          reducedMotion={reduced || paused}
          attempt={attempt}
          onError={() => setModelError(true)}
          onSceneError={() => {
            useStudio.getState().notify('That scene couldn’t load. Your look is safe.', 'error')
            setSceneLoading(false)
            goHub()
          }}
          onSceneReady={() => {
            setSceneReadyId(useStudio.getState().look.scene.id)
            if (!sceneLoading) return
            setSceneLoading(false)
          }}
          onDoorWalked={throughDoor}
          onPeer={(p) => openPeer({ id: p.id, name: p.name })}
        />
      )}

      <div className="pointer-events-none absolute inset-0">
        {phase === 'onboard' && !uiHidden && catalog && <PickDoll wide={wide} size={size} catalog={catalog} onNext={goHub} />}
        {phase === 'hub' && <HubUI wide={wide} onChangeDoll={() => useStudio.getState().setPhase('onboard')} onProfile={() => setProfile(true)} />}
        {profile && (
          <div className="pointer-events-auto fixed inset-0 z-40 grid place-items-center bg-black/50 p-3" onClick={() => setProfile(false)}>
            <div role="dialog" aria-label="My profile" className="ds-pop ds-sheet ds-scroll-y max-h-[86dvh] w-full max-w-md rounded-[28px] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center">
                <h2 className="flex-1 text-[22px] font-black">My profile</h2>
                <button type="button" aria-label="Close" onClick={() => setProfile(false)} className="grid h-10 w-10 place-items-center rounded-full">
                  <Icon name="close" />
                </button>
              </div>
              <ProfilePanel />
            </div>
          </div>
        )}
        {phase === 'scenes' && !uiHidden && (
          <SceneSelect
            wide={wide}
            loading={sceneReadyId !== look.scene.id}
            onBack={goHub}
            onGo={() => {
              void flushSave()
              goEvent()
              welcome(useStudio.getState().look.profile.name || 'gorgeous')
            }}
          />
        )}
        {phase === 'studio' && !uiHidden && catalog && room && <RoomUI catalog={catalog as CharacterCatalog} wide={wide} onHub={goHub} onScene={goScenes} />}
        {phase === 'event' && <EventView onBackToStudio={goHub} onChangeScene={goScenes} onOutfit={goHub} />}
        {(phase === 'studio' || phase === 'event') && (
          <div className="absolute inset-x-0 top-[calc(max(env(safe-area-inset-top),8px)+58px)] z-30 flex justify-center px-3">
            <ActionHud />
          </div>
        )}
        {uiHidden && phase !== 'event' && phase !== 'hub' && (
          <button type="button" onClick={() => useStudio.setState({ uiHidden: false })} aria-label="Show controls" className="ds-fab pointer-events-auto absolute bottom-[max(env(safe-area-inset-bottom),16px)] right-4 z-30 grid h-12 w-12 place-items-center rounded-full">
            <Icon name="eye" />
          </button>
        )}
        {sceneLoading && phase === 'event' && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-ink/70" role="status" aria-live="polite">
            <div className="flex flex-col items-center gap-3">
              <p className="text-[26px] font-black">{SCENE_BY_ID[look.scene.id as SceneId]?.name ?? 'Scene'} loading…</p>
              <div className="ds-loading-bar h-0.5 w-40 rounded-full" />
            </div>
          </div>
        )}
        {phase === 'studio' && room && (
          <span className="sr-only" aria-live="polite">
            {ROOMS[room].name}
          </span>
        )}
        {wash && <div key={wash.key} className="ds-wash pointer-events-none absolute inset-0 z-30" style={{ background: `radial-gradient(circle at 50% 45%, #fff 0%, ${wash.color} 55%, ${wash.color} 100%)` }} onAnimationEnd={() => setWash(null)} />}
        <ResultPop />
        <Toasts />
        <ConfirmDialog />
      </div>

      {!bootGone && <Boot progress={preloadProgress(pre)} error={bootError} onRetry={retry} leaving={phase !== 'boot'} onGone={() => setBootGone(true)} />}
      <RescueOnHide />
      <SkinHealer />
      <RealtimeSync />
    </main>
  )
}

/** Keep the last valid look on the device when the page is hidden or closed. */
function RescueOnHide() {
  useEffect(() => {
    const save = () => rescueLook()
    window.addEventListener('pagehide', save)
    return () => window.removeEventListener('pagehide', save)
  }, [])
  return null
}
