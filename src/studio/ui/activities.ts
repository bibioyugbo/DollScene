import type { SceneId } from '../scenes'
import type { ExpressionPreset, PoseId } from '../state/store'
import type { Sfx } from './sound'

/**
 * Things to do at each scene beyond posing: each sets a pose (or a little loop of poses, like a
 * dance), a face and a sound, and everyone at the scene sees it on your doll.
 */
export interface Activity {
  id: string
  label: string
  emoji: string
  pose: PoseId
  expr: ExpressionPreset
  /** A loop of poses (seconds per pose). */
  loop?: { poses: PoseId[]; every: number }
  sfx?: Sfx
}

const dance = (label = 'Dance'): Activity => ({ id: 'dance', label, emoji: '💃', pose: 'wave', expr: 'laugh', loop: { poses: ['wave', 'hands-on-hips', 'peace', 'hair-touch'], every: 0.9 }, sfx: 'sparkle' })
const selfie: Activity = { id: 'selfie', label: 'Selfie', emoji: '🤳', pose: 'selfie', expr: 'smile', sfx: 'chime' }
const toast: Activity = { id: 'toast', label: 'Toast', emoji: '🥂', pose: 'wave', expr: 'laugh', sfx: 'chime' }

export const ACTIVITIES: Record<SceneId, Activity[]> = {
  prom2016: [dance(), { id: 'punch', label: 'Grab punch', emoji: '🍹', pose: 'hands-clasped', expr: 'smile' }, selfie, { id: 'crown', label: 'Prom queen wave', emoji: '👑', pose: 'wave', expr: 'smile', sfx: 'sparkle' }],
  wedding: [toast, { id: 'bouquet', label: 'Catch the bouquet', emoji: '💐', pose: 'hair-touch', expr: 'surprised', sfx: 'sparkle' }, dance('First dance'), selfie],
  rave: [dance('Rave'), { id: 'glow', label: 'Glow sticks', emoji: '🪩', pose: 'peace', expr: 'laugh', loop: { poses: ['peace', 'wave'], every: 0.5 } }, selfie],
  fall: [{ id: 'leaves', label: 'Leaf toss', emoji: '🍂', pose: 'wave', expr: 'laugh', sfx: 'whoosh' }, { id: 'cozy', label: 'Cosy', emoji: '☕', pose: 'hands-clasped', expr: 'soft' }, selfie],
  beach: [{ id: 'splash', label: 'Splash', emoji: '🌊', pose: 'wave', expr: 'laugh', sfx: 'splash' }, { id: 'sun', label: 'Sunbathe', emoji: '☀️', pose: 'hair-touch', expr: 'soft' }, dance('Beach dance'), selfie],
  rooftop: [toast, dance(), selfie, { id: 'skyline', label: 'Take in the view', emoji: '🌃', pose: 'thinking', expr: 'soft' }],
  moviefest: [{ id: 'carpet', label: 'Red-carpet pose', emoji: '📸', pose: 'hand-on-hip', expr: 'smile', sfx: 'chime' }, { id: 'fans', label: 'Wave to fans', emoji: '👋', pose: 'wave', expr: 'smile' }, { id: 'kiss', label: 'Blow a kiss', emoji: '😘', pose: 'blow-kiss', expr: 'pout' }, selfie],
  cinema: [{ id: 'popcorn', label: 'Popcorn', emoji: '🍿', pose: 'hands-clasped', expr: 'smile' }, { id: 'plot', label: 'Plot twist!', emoji: '😱', pose: 'thinking', expr: 'surprised' }, { id: 'sad', label: 'Sad scene', emoji: '🥲', pose: 'hands-clasped', expr: 'sad' }, selfie],
  halloween: [{ id: 'spooky', label: 'Spooky', emoji: '👻', pose: 'arms-crossed', expr: 'surprised' }, { id: 'trick', label: 'Trick or treat', emoji: '🎃', pose: 'wave', expr: 'laugh' }, selfie],
}
