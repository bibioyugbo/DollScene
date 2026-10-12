import type { EarthPalette } from '../../three/globeArt'

export type SceneId = 'candy' | 'spacy' | 'earthy' | 'icy'

/** Colours for the top-right controls and the logo box, so they belong to the scene. */
export interface SceneChrome {
  /** Button and 18+ badge: face, border/shadow, text. */
  face: string
  edge: string
  text: string
  /** Logo box behind the (always pink) doll. */
  logoBox: string
}

export interface LandingScene {
  id: SceneId
  label: string
  emoji: string
  /** Dark scenes switch the header and hints to light text. */
  dark: boolean
  chrome: SceneChrome
  earth: EarthPalette
}

/** "Change the scene" on the landing cycles through these. */
export const SCENES: LandingScene[] = [
  {
    id: 'candy',
    label: 'Bubblegum',
    emoji: '🍬',
    dark: false,
    chrome: { face: '#FFFFFF', edge: '#FF8CC0', text: '#E8187A', logoBox: '#FFE3EF' },
    earth: { sea: ['#FFC9E0', '#FFDCEB'], land: '#FF6FAE', outline: '#FFFFFF', edge: '#E8418A', dots: 'rgba(255,255,255,0.75)' },
  },
  {
    id: 'spacy',
    label: 'Spacy',
    emoji: '🪐',
    dark: true,
    chrome: { face: '#2A1B5E', edge: '#9B8CFF', text: '#E6E0FF', logoBox: '#2A1B5E' },
    earth: { sea: ['#24175A', '#36267E'], land: '#9B8CFF', outline: '#D9D2FF', edge: '#5B47D6', dots: 'rgba(217,210,255,0.45)' },
  },
  {
    id: 'earthy',
    label: 'Earthy',
    emoji: '🌿',
    dark: false,
    chrome: { face: '#FBF6EA', edge: '#6E8F4A', text: '#3F5A28', logoBox: '#F1E8D2' },
    earth: { sea: ['#5FA8C9', '#8CC7DD'], land: '#6E9A4A', outline: '#F6EEDC', edge: '#3F5A28', dots: 'rgba(246,238,220,0.6)' },
  },
  {
    id: 'icy',
    label: 'Icy',
    emoji: '❄️',
    dark: false,
    chrome: { face: '#F4FBFF', edge: '#8CCFF5', text: '#2A7FB8', logoBox: '#E0F3FF' },
    earth: { sea: ['#BFE4FA', '#E0F3FF'], land: '#FFFFFF', outline: '#9ED8FF', edge: '#3E9BD6', dots: 'rgba(255,255,255,0.9)' },
  },
]

const KEY = 'dc:landing-scene'
export function loadScene(): SceneId {
  try {
    const v = localStorage.getItem(KEY)
    return SCENES.some((s) => s.id === v) ? (v as SceneId) : 'candy'
  } catch {
    return 'candy'
  }
}
export function saveScene(id: SceneId) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* private mode: the scene resets next visit */
  }
}
