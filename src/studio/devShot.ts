import { CHARACTER_PRESETS } from '../shared/studio/presets'
import { useStudio, type Angle, type Category, type Framing, type Phase } from './state/store'

/**
 * Dev-only hooks for automated screenshots and checks (never in a production build):
 *   ?shot&phase=studio&cat=hairstyles&hair=afro_big&angle=back&framing=bust&spin=0.4
 * window.__dsShotReady turns true once the character has loaded and rendered.
 */
declare global {
  interface Window {
    __dsShotReady?: boolean
    __dsStudio?: typeof useStudio
    __dsPresets?: typeof CHARACTER_PRESETS
  }
}

export function applyShotParams() {
  if (!import.meta.env.DEV) return
  window.__dsStudio = useStudio
  window.__dsPresets = CHARACTER_PRESETS
  const q = new URLSearchParams(location.search)
  if (!q.has('shot')) return
  const s = useStudio.getState()
  const hair = q.get('hair')
  if (hair) useStudio.setState({ look: { ...s.look, hair: { ...s.look.hair, style: hair as never, care: { ...s.look.hair.care, bonnet: false, change: null } } } })
  if (q.has('onboarded')) useStudio.setState((x) => ({ look: { ...x.look, profile: { ...x.look.profile, onboarded: true, name: x.look.profile.name || 'Ada' } } }))
  const cat = q.get('cat') as Category | null
  if (cat) s.setCategory(cat)
  const framing = q.get('framing') as Framing | null
  if (framing) s.setFraming(framing)
  const angle = q.get('angle') as Angle | null
  if (angle) s.setAngle(angle)
  const spin = q.get('spin')
  if (spin) s.setSpin(Number(spin))
  if (q.has('hideui')) useStudio.setState({ uiHidden: true })
  const phase = q.get('phase') as Phase | null
  if (phase) {
    // wait for boot to hand over, then jump
    const unsub = useStudio.subscribe((st) => {
      if (st.phase === 'scenes') {
        unsub()
        useStudio.getState().setPhase(phase)
        if (cat) useStudio.getState().setCategory(cat)
        if (framing) useStudio.getState().setFraming(framing)
      }
    })
  }
}

export function markShotReady() {
  if (!import.meta.env.DEV) return
  // Two frames after the boot hands over, so the first render with all modules has landed.
  requestAnimationFrame(() => requestAnimationFrame(() => (window.__dsShotReady = true)))
}
