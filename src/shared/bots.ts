import { avatarSummary } from './appearance'
import { CITIES, jitteredPlace } from './cities'
import { makeRng } from './demo'
import { STARTERS, starterAppearance } from './starters'
import type { Aesthetic, CareerId, PublicDoll } from './types'

/**
 * Light background residents so the globe feels busy: one in every city, a few
 * more in Lagos. They are labelled residents (kind 'npc'), only have a public
 * card (no crib, no posts), and say yes to friend requests like the main cast.
 */
const FIRST = ['Ada', 'Zara', 'Kemi', 'Tolu', 'Amaka', 'Nneka', 'Fola', 'Bisi', 'Ife', 'Ama', 'Kojo', 'Kwame', 'Sade', 'Lola', 'Nia', 'Imani', 'Wanjiru', 'Thandi', 'Lerato', 'Zola', 'Aaliyah', 'Maya', 'Chloé', 'Inès', 'Léa', 'Sofia', 'Valentina', 'Mei', 'Yuki', 'Priya', 'Aisha', 'Fatima', 'Layla', 'Jade', 'Remi', 'Dayo', 'Tunde', 'Obi', 'Chidi', 'Emeka', 'Seun', 'Jaylen', 'Andre', 'Mateo', 'Luca', 'Kenji', 'Omar', 'Malik', 'Noah', 'Theo']
const LAST = ['Okafor', 'Balogun', 'Adebayo', 'Mensah', 'Boateng', 'Diallo', 'Ndlovu', 'Kamau', 'Otieno', 'Nkosi', 'Mbeki', 'Haddad', 'Silva', 'Santos', 'Dubois', 'Martin', 'Rossi', 'Kim', 'Tanaka', 'Patel', 'Khan', 'Johnson', 'Brown', 'Williams', 'Okoro', 'Eze', 'Afolabi', 'Lawal', 'Bello', 'Ibrahim']
const AESTHETICS: Aesthetic[] = ['streetwear', 'soft-glam', 'goth', 'kawaii', 'luxury', 'minimal', 'y2k', 'alt', 'nightlife', 'editorial', 'owambe']
const TAGS = ['It Girl', 'Baddie', 'Soft Life', 'Main Character', 'Fashionista', 'Street', 'Socialite', 'Creative', 'Night Owl', 'Gym Rat', 'Bookworm', 'Party Starter']
const CAREERS: CareerId[] = ['barista', 'shop-assistant', 'receptionist', 'junior-stylist', 'social-media-intern']
const HAIR = ['#1B1214', '#2B1B17', '#4A2C21', '#7B4A2E', '#C9A227', '#E8D3A2', '#FF5FA2', '#A86BFF', '#00A88F', '#D93A3A']
const BIOS = ['Here for the fits and the gist.', 'Outfit repeater? Never heard of her.', 'Soft life loading…', 'Ask me where I got it.', 'Brunch, then the runway.', 'Collecting looks and good vibes.']

export const BOT_COUNT = CITIES.length + 6

export function generateBots(now: number): PublicDoll[] {
  const out: PublicDoll[] = []
  const lagos = CITIES.find((c) => c.name === 'Lagos')!
  const cities = [...CITIES, lagos, lagos, lagos, lagos, lagos, lagos]
  cities.forEach((city, i) => {
    const rand = makeRng(5000 + i * 31)
    const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]
    const a = starterAppearance(STARTERS[Math.floor(rand() * STARTERS.length)].id)
    a.hair = { ...a.hair, color: pick(HAIR) }
    const first = pick(FIRST)
    const last = pick(LAST)
    const aes = [pick(AESTHETICS), pick(AESTHETICS)].filter((x, k, arr) => arr.indexOf(x) === k)
    const online = rand() < 0.35
    const fame = Math.floor(rand() * 900)
    out.push({
      uid: `bot-${i}`,
      kind: 'npc',
      name: `${first} ${last}`,
      username: `${first}.${last}${i}`.toLowerCase().normalize('NFD').replace(/[^a-z0-9.]/g, ''),
      bio: pick(BIOS),
      aesthetics: aes,
      badges: ['Resident'],
      privacy: { showLocation: true, showOnline: true, dms: 'everyone' },
      portrait: null,
      avatar: avatarSummary(a),
      ...jitteredPlace(city, rand),
      career: pick(CAREERS),
      careerLevel: 1 + Math.floor(rand() * 3),
      styleTag: pick(TAGS),
      outfitSummary: '',
      pronouns: '',
      fame,
      followers: Math.floor(fame / 5),
      following: Math.floor(rand() * 120),
      friendCount: Math.floor(rand() * 40),
      online,
      lastActive: online ? now : now - Math.floor(rand() * 3 * 86400000),
      lastPostAt: 0,
      createdAt: now - 30 * 86400000,
    })
  })
  return out
}
