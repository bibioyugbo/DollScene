/**
 * Domain types shared by the web client, the local backend and Cloud Functions.
 * Keep this file free of DOM, Vite and Firebase imports.
 */
import type { Look2D } from './look2d'

/* ---------------------------------------------------------------- appearance */

export type Base = 'feminine' | 'masculine' | 'androgynous'
export type Undertone = 'warm' | 'cool' | 'neutral' | 'golden' | 'red'
export type SkinMarkKind = 'freckles' | 'beauty-marks' | 'birthmark' | 'vitiligo' | 'scars' | 'stretch-marks'

export interface SkinState {
  /** Body complexion. */
  tone: string
  undertone: Undertone
  /** Separate face complexion, or null to match the body. */
  faceTone: string | null
  /** 0..1 intensity per mark; missing means none. */
  marks: Partial<Record<SkinMarkKind, number>>
  /** 0..1 sheen. */
  glow: number
}

export interface FaceState {
  preset: string
  /** All sliders are 0..1 with 0.5 as neutral. */
  nose: number
  lips: number
  jaw: number
  cheekbones: number
  chin: number
  forehead: number
  eyeSize: number
  eyeSpacing: number
  /** 0 round, 1 almond/hooded. */
  eyeShape: number
  brows: number
  asymmetry: number
  eyeColor: string
}

export interface BodyState {
  preset: string
  /** 0.85..1.15 */
  height: number
  shoulders: number
  waist: number
  hips: number
  bust: number
  legs: number
  muscle: number
  softness: number
}

export type HairStyleId =
  | 'afro'
  | 'twa'
  | 'locs'
  | 'sisterlocs'
  | 'freeform-locs'
  | 'knotless-braids'
  | 'box-braids'
  | 'fulani-braids'
  | 'cornrows'
  | 'bantu-knots'
  | 'twists'
  | 'faux-locs'
  | 'lace-front'
  | 'sew-in'
  | 'silk-press'
  | 'puffs'
  | 'high-puff'
  | 'natural-updo'
  | 'bob'
  | 'bun'
  | 'fade'
  | 'taper'
  | 'short-cut'
  | 'buzz'
  | 'bald'
  | 'pixie'
  | 'ponytail'
  | 'long-straight'
  | 'long-curly'
  | 'fringe-bob'
  | 'mohawk'
  | 'shaved-sides'

export type DyeMode =
  | 'solid'
  | 'ombre'
  | 'balayage'
  | 'highlights'
  | 'peekaboo'
  | 'split'
  | 'root-shadow'
  | 'gradient-ends'
  | 'bleached-tips'

export type EdgeStyle = 'none' | 'sleek' | 'swoop' | 'waves' | 'scallop' | 'dramatic'
export type Parting = 'none' | 'middle' | 'side-left' | 'side-right' | 'zigzag'
export type CurlPattern = '1' | '2a' | '2c' | '3a' | '3c' | '4a' | '4b' | '4c'
export type HairAccessoryId =
  | 'beads'
  | 'cuffs'
  | 'clips'
  | 'bows'
  | 'scarf'
  | 'headwrap'
  | 'gele'
  | 'flowers'
  | 'pearls'

export interface HairLook {
  style: HairStyleId
  /** 0..1 */
  length: number
  /** 0..1 */
  volume: number
  parting: Parting
  curl: CurlPattern
  color: string
  dye: { mode: DyeMode; color2: string; gloss: number }
  edges: { style: EdgeStyle; density: number; swirl: number }
  accessories: HairAccessoryId[]
  accessoryColor: string
}

export interface SavedHairLook extends HairLook {
  id: string
  name: string
}

export type Eyeliner = 'none' | 'thin' | 'wing' | 'graphic'
export type Lashes = 'none' | 'natural' | 'volume' | 'drama'
export type BrowStyle = 'natural' | 'laminated' | 'thin' | 'bold' | 'skinny' | 'thick' | '2016' | 'shaped' | 'slit'
export type SpecialLook = 'none' | 'glitter' | 'face-gems' | 'freckle-art' | 'tribal-dots' | 'chrome'

export interface MakeupState {
  foundation: number
  blush: string | null
  blushAmount: number
  contour: number
  highlight: number
  eyeshadow: string | null
  eyeliner: Eyeliner
  lashes: Lashes
  brows: BrowStyle
  lipstick: string | null
  /** Lip liner colour, or null for none. */
  lipLiner: string | null
  gloss: number
  look: SpecialLook
  /** Last applied preset id, for display only. */
  preset: string | null
}

export type FacialHairStyle = 'none' | 'stubble' | 'moustache' | 'goatee' | 'short-beard' | 'full-beard' | 'sideburns' | 'chin-strap'

export interface FacialHair {
  style: FacialHairStyle
  color: string
  /** 0..1 */
  density: number
}

export type NailShape = 'round' | 'square' | 'almond' | 'coffin' | 'stiletto'
export type NailPattern = 'solid' | 'french' | 'chrome' | 'ombre' | 'marble' | 'ankara' | 'glitter'

export interface NailsState {
  shape: NailShape
  length: number
  color: string
  pattern: NailPattern
  charms: boolean
}

export type PiercingSite =
  // ear
  | 'lobe'
  | 'lobe-2'
  | 'lobe-3'
  | 'upper-lobe'
  | 'helix'
  | 'forward-helix'
  | 'tragus'
  | 'anti-tragus'
  | 'conch-inner'
  | 'conch-outer'
  | 'daith'
  | 'rook'
  | 'industrial'
  | 'flat'
  | 'orbital'
  // face
  | 'nostril'
  | 'high-nostril'
  | 'septum'
  | 'bridge'
  | 'eyebrow'
  | 'labret'
  | 'monroe'
  | 'medusa'
  | 'snake-bites'
  | 'smiley'
  | 'tongue'
  // body
  | 'navel'
  | 'dermal'
  | 'surface'

export type PiercingSide = 'left' | 'right' | 'both' | 'center'
export type Jewellery = 'stud' | 'hoop' | 'barbell' | 'ring' | 'chain' | 'cuff'
export type Metal = 'gold' | 'silver' | 'rose-gold' | 'black' | 'titanium'
export type Gem = 'none' | 'diamond' | 'ruby' | 'emerald' | 'sapphire' | 'opal' | 'pearl'

export interface Piercing {
  id: string
  site: PiercingSite
  side: PiercingSide
  jewellery: Jewellery
  metal: Metal
  gem: Gem
  /** 0..1 */
  size: number
}

export type TattooRegion =
  | 'face'
  | 'neck'
  | 'chest'
  | 'back'
  | 'shoulder-l'
  | 'shoulder-r'
  | 'arm-l'
  | 'arm-r'
  | 'forearm-l'
  | 'forearm-r'
  | 'hand-l'
  | 'hand-r'
  | 'fingers'
  | 'ribs'
  | 'stomach'
  | 'hip-l'
  | 'hip-r'
  | 'thigh-l'
  | 'thigh-r'
  | 'calf-l'
  | 'calf-r'
  | 'ankle-l'
  | 'ankle-r'
  | 'foot-l'
  | 'foot-r'

export type TattooStyle =
  | 'fine-line'
  | 'adinkra'
  | 'tribal'
  | 'script'
  | 'floral'
  | 'geometric'
  | 'traditional'
  | 'realism'
  | 'afrofuturist'
  | 'henna'
  | 'body-paint'

export interface Tattoo {
  id: string
  region: TattooRegion
  /** Design id from the tattoo library. */
  design: string
  /** 0..1 */
  size: number
  /** Degrees. */
  rotation: number
  /** 0..1 */
  opacity: number
  mirror: boolean
  /** null renders black and grey. */
  color: string | null
  layer: number
  temporary: boolean
}

export interface Identity {
  pronouns: string
  genderExpression: string
  orientation: string
  datingPreference: string
}

export type OutfitSlot =
  | 'top'
  | 'bottom'
  | 'dress'
  | 'outerwear'
  | 'shoes'
  | 'bag'
  | 'headwear'
  | 'eyewear'
  | 'earrings'
  | 'necklace'
  | 'bracelet'
  | 'swimwear'
  | 'belt'

export type Outfit = Partial<Record<OutfitSlot, string>>

export interface Appearance {
  version: 2
  starterId: string
  base: Base
  skin: SkinState
  face: FaceState
  body: BodyState
  hair: HairLook
  makeup: MakeupState
  nails: NailsState
  facialHair: FacialHair
  piercings: Piercing[]
  tattoos: Tattoo[]
  /** Item ids from the catalog, or starter garments (id prefix "starter-"). */
  outfit: Outfit
  /** Clinic procedure ids applied, in order. */
  clinic: string[]
  identity: Identity
  /** The 2D cartoon look picked on the landing. Missing on older dolls. */
  look?: Look2D
}

/** Small projection used to draw avatar bubbles without loading the whole doll. */
export interface AvatarSummary {
  base: Base
  skin: string
  hairStyle: HairStyleId
  hairColor: string
  hairColor2: string
  topColor: string
  eyeColor: string
  lipColor: string
  accessory: HairAccessoryId | null
  /** When present, bubbles and cards draw the 2D character. */
  look?: Look2D
}

/* ------------------------------------------------------------------ catalog */

export type ItemCategory =
  | 'fashion'
  | 'shoes'
  | 'bags'
  | 'jewellery'
  | 'eyewear'
  | 'swimwear'
  | 'hair'
  | 'beauty'
  | 'home'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'limited'

export type Pattern =
  | 'solid'
  | 'ankara'
  | 'adire'
  | 'aso-oke'
  | 'kente'
  | 'denim'
  | 'leopard'
  | 'check'
  | 'stripe'
  | 'floral'
  | 'monogram'
  | 'sequin'
  | 'lace'

export type GarmentTemplate =
  | 'tee'
  | 'crop'
  | 'tank'
  | 'blouse'
  | 'shirt'
  | 'corset'
  | 'buba'
  | 'hoodie'
  | 'blazer'
  | 'jacket'
  | 'puffer'
  | 'agbada'
  | 'kaftan'
  | 'mini-skirt'
  | 'midi-skirt'
  | 'maxi-skirt'
  | 'wrapper'
  | 'trousers'
  | 'cargo'
  | 'jeans'
  | 'shorts'
  | 'mini-dress'
  | 'midi-dress'
  | 'gown'
  | 'boubou'
  | 'jumpsuit'
  | 'bikini'
  | 'one-piece'
  | 'sneakers'
  | 'heels'
  | 'boots'
  | 'sandals'
  | 'loafers'
  | 'tote'
  | 'clutch'
  | 'backpack'
  | 'gele'
  | 'cap'
  | 'beret'
  | 'headwrap'
  | 'bucket-hat'
  | 'sunglasses'
  | 'glasses'
  | 'hoops'
  | 'studs'
  | 'drops'
  | 'chain'
  | 'pendant'
  | 'waist-beads'
  | 'coral-beads'
  | 'bangle'
  | 'watch'
  | 'belt'
  | 'bralette'
  | 'robe'

export type FurnitureTemplate =
  | 'sleeping-mat'
  | 'bed-single'
  | 'bed-double'
  | 'sofa'
  | 'loveseat'
  | 'armchair'
  | 'beanbag'
  | 'coffee-table'
  | 'side-table'
  | 'dining-table'
  | 'chair'
  | 'stool'
  | 'desk'
  | 'bookshelf'
  | 'tv-stand'
  | 'wardrobe'
  | 'clothes-rack'
  | 'vanity'
  | 'dresser'
  | 'mirror-floor'
  | 'floor-lamp'
  | 'table-lamp'
  | 'neon-sign'
  | 'plant-tall'
  | 'plant-small'
  | 'rug-round'
  | 'rug-rect'
  | 'art-frame'
  | 'wall-shelf'
  | 'wall-mirror'
  | 'kitchen-counter'
  | 'fridge'
  | 'stove'
  | 'bathtub'
  | 'sink'
  | 'speaker'
  | 'pet-cat'
  | 'pet-dog'
  | 'ghana-must-go'
  | 'poster'
  | 'chandelier'
  | 'bouquet'
  | 'wine-rack'
  | 'aquarium'
  | 'palm'
  | 'cactus'
  | 'plant-hanging'

/** Unlocks used by the customizer: hair accessories, lipstick and nail shades. */
export type BeautyUnlock = { kind: 'hair-accessory'; id: HairAccessoryId } | { kind: 'shade'; color: string; label: string }

export type FurnitureRoom = 'living' | 'bedroom' | 'vanity-closet' | 'kitchen' | 'bathroom' | 'decor' | 'lighting' | 'plants' | 'art'

export interface FurnitureSpec {
  template: FurnitureTemplate
  room: FurnitureRoom
  /** floor: stands on the floor; wall: hangs on a wall; rug: flat, others can stand on it. */
  mount: 'floor' | 'wall' | 'rug'
  /** Footprint in metres. */
  w: number
  d: number
  h: number
}

/** Fashion identities used for filtering, challenges and profiles. */
export type Aesthetic = 'streetwear' | 'soft-glam' | 'goth' | 'kawaii' | 'luxury' | 'minimal' | 'y2k' | 'alt' | 'nightlife' | 'editorial' | 'owambe'

export interface CatalogItem {
  id: string
  name: string
  brandId: string
  category: ItemCategory
  /** Wearable slot, or null for home and beauty items. */
  slot: OutfitSlot | null
  template: GarmentTemplate | FurnitureTemplate | 'unlock'
  colors: [string, string]
  pattern: Pattern
  rarity: Rarity
  price: number
  tags: string[]
  aesthetics?: Aesthetic[]
  drop?: 'seasonal' | 'limited' | 'collab'
  furniture?: FurnitureSpec
  unlock?: BeautyUnlock
  /** Can only be bought from this level up. */
  unlockLevel?: number
}

export type BrandRegion = 'nigeria' | 'america' | 'france' | 'thrift' | 'global'

export interface Brand {
  id: string
  /** Real label name. Shown only while licensing is pending or signed. */
  name: string
  /** Fictional "inspired by" label used when real names are switched off. */
  placeholderName: string
  region: BrandRegion
  tagline: string
  /** True for real brands we do not have written permission for yet. */
  licensedPending: boolean
  accent: string
  /** Which Drip aisle the store sits in. */
  vibe?: DripVibe
}

/** The Drip aisles: what kind of store a brand is. */
export type DripVibe = 'streetwear' | 'elegant' | 'luxury' | 'gym' | 'baddie' | 'basic' | 'trad' | 'thrift' | 'home'

/* ------------------------------------------------------------------ careers */

export type MiniGameId = 'order-up' | 'rush-hour' | 'match-look' | 'rhythm' | 'snap' | 'sort'

export type CareerId =
  // starter jobs
  | 'barista'
  | 'shop-assistant'
  | 'receptionist'
  | 'junior-stylist'
  | 'social-media-intern'
  // career paths
  | 'event-organiser'
  | 'fashion-designer'
  | 'model'
  | 'musician'
  | 'actor'
  | 'photographer'
  | 'makeup-artist'
  | 'hair-stylist'
  | 'influencer'
  | 'dj'
  | 'bartender'
  | 'chef'
  | 'entrepreneur'
  | 'software-developer'
  | 'doctor'
  | 'lawyer'
  | 'artist'
  | 'dancer'
  | 'real-estate-agent'
  | 'nail-technician'
  | 'personal-stylist'

export interface CareerState {
  id: CareerId
  level: number
  xp: number
  reputation: number
  startedAt: number
}

/* --------------------------------------------------------------- documents */

export type RegionId =
  | 'west-africa'
  | 'east-africa'
  | 'southern-africa'
  | 'north-africa'
  | 'europe'
  | 'north-america'
  | 'caribbean'
  | 'south-america'
  | 'middle-east'
  | 'asia'
  | 'oceania'

export interface Place {
  city: string
  country: string
  region: RegionId
  /** City centre plus jitter. Never the player's real position. */
  lat: number
  lng: number
}

/** users/{uid}: private to the owner. */
export interface UserDoc {
  uid: string
  email: string | null
  createdAt: number
  ageConfirmed: boolean
  /** Date of birth (YYYY-MM-DD). Private; checked on the server to be 18+. */
  dob: string
  ageVerifiedAt: number
  username: string | null
  /** The chosen city, kept privately so location can be hidden and shown again. */
  homeCity?: { city: string; country: string }
  onboarded: boolean
  starterChanges: number
  pushTokens?: string[]
}

/** dolls/{uid}: the full appearance, readable by signed-in players. */
export interface DollDoc {
  uid: string
  name: string
  appearance: Appearance
  hairLooks: SavedHairLook[]
  complexionPresets: { id: string; name: string; tone: string; undertone: Undertone; faceTone: string | null }[]
  facePresets: FacePreset[]
  updatedAt: number
}

/** A saved face: shape, skin and makeup together. */
export interface FacePreset {
  id: string
  name: string
  face: FaceState
  skin: SkinState
  makeup: MakeupState
}

export interface PrivacySettings {
  /** Show city on profile and a pin on the globe. */
  showLocation: boolean
  showOnline: boolean
  /** Who can start a chat. */
  dms: 'everyone' | 'friends'
}

/** Curated in-world resident. Never a real person. */
export interface NpcProfile {
  personality: string
  lore: string
  job: string
  routine: string[]
  hangouts: string[]
  fashion: string
  circle: string[]
  activity: string[]
}

/** publicDolls/{uid}: what the globe, explore and cards need. Public. */
export interface PublicDoll extends Place {
  uid: string
  /** Players are real accounts; NPCs are curated residents and always labelled. */
  kind: 'player' | 'npc'
  name: string
  username: string
  bio: string
  aesthetics: Aesthetic[]
  badges: string[]
  privacy: PrivacySettings
  npc?: NpcProfile
  portrait: string | null
  avatar: AvatarSummary
  career: CareerId
  careerLevel: number
  styleTag: string
  outfitSummary: string
  pronouns: string
  fame: number
  followers: number
  following: number
  friendCount: number
  online: boolean
  lastActive: number
  /** Last time this doll posted a new look; drives the globe pulse. */
  lastPostAt: number
  isDemo?: boolean
  createdAt: number
}

export interface MissionProgress {
  /** Period key, e.g. 2026-10-08 or 2026-W41. */
  key: string
  counts: Record<string, number>
  claimed: string[]
}

/** playerProgress/{uid}: written only by the server. */
export interface ProgressDoc {
  uid: string
  dollies: number
  gems: number
  career: CareerState
  careerHistory: { id: CareerId; level: number; endedAt: number }[]
  starterJob: CareerId
  distinctPlayDays: number
  lastPlayDay: string
  shifts: { day: string; count: number; lastAt: number; active: { id: string; startedAt: number; game: MiniGameId } | null }
  daily: MissionProgress
  weekly: MissionProgress
  objectives: Record<string, 'done' | 'claimed'>
  counters: Record<string, number>
  friendRequests: { day: string; count: number }
  fame: number
  /** Lifetime XP; level comes from it (see levels.ts). Missing on older saves = 0. */
  xp?: number
  /** Highest level whose reward has been collected (missing = 1). */
  levelRewarded?: number
  /** Parties attended today (one reward per party per day). */
  parties?: { day: string; ids: string[] }
  apartmentTier: ApartmentTierId
  updatedAt: number
}

export interface InventoryDoc {
  uid: string
  /** itemId -> count owned. */
  items: Record<string, number>
  /** Rent a Fit: itemId -> expiry timestamp. */
  rentals?: Record<string, number>
}

export interface OutingDoc {
  id: string
  from: string
  to: string
  fromName: string
  toName: string
  place: string
  kind: 'friendship' | 'romantic'
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
}

export interface OutfitPreset {
  id: string
  name: string
  outfit: Outfit
}

export interface OutfitsDoc {
  uid: string
  presets: OutfitPreset[]
  /** Favourite item ids (owned or not). */
  favourites: string[]
}

export type ApartmentTierId = 'studio' | 'loft' | 'penthouse' | 'mansion' | 'beach-house'
export type WallSide = 'back' | 'left'
export type LightingMood = 'day' | 'golden' | 'night' | 'club'
export type WindowView = 'lagos' | 'city' | 'beach' | 'stars' | 'garden'
export type FloorMaterial = 'concrete' | 'oak' | 'walnut' | 'marble' | 'tile' | 'carpet'
export type Wallpaper = 'none' | 'ankara' | 'adire' | 'stripe' | 'floral' | 'check' | 'cheetah' | 'girly' | 'black'
export type WindowStyle = 'classic' | 'arched' | 'tall' | 'round'
export type WindowSpot = 'left' | 'center' | 'right'

export interface PlacedItem {
  /** Instance id. */
  id: string
  itemId: string
  x: number
  z: number
  /** Radians. */
  rot: number
  /** For wall items: which wall and height of the centre. */
  wall?: WallSide
  y?: number
}

export interface ApartmentDoc {
  uid: string
  tier: ApartmentTierId
  wallColor: string
  wallpaper: Wallpaper
  floor: FloorMaterial
  lighting: LightingMood
  windowView: WindowView
  items: PlacedItem[]
  /** Saved named layouts the player can switch between. */
  layouts?: SavedLayout[]
  /** Move-in day: luggage still waiting to be unpacked. */
  luggage?: string[]
  /** The furnished starter home (sofa, plants, maybe a pet) has been set up. */
  starterHome?: boolean
  /** Window shape and where it sits on the back wall; a balcony swaps it for glass doors. */
  windowStyle?: WindowStyle
  windowSpot?: WindowSpot
  balcony?: boolean
  /** True once the delivery truck has been seen. */
  movedIn?: boolean
  updatedAt: number
}

export interface SavedLayout {
  id: string
  name: string
  items: PlacedItem[]
  wallColor: string
  wallpaper: Wallpaper
  floor: FloorMaterial
  lighting: LightingMood
  savedAt: number
}

/* -------------------------------------------------------------- challenges */

export interface ChallengeEntryDoc {
  /** `${challengeKey}_${uid}` */
  id: string
  challengeKey: string
  uid: string
  kind: 'player' | 'npc'
  name: string
  username: string
  avatar: AvatarSummary
  portrait: string | null
  outfit: Outfit
  caption: string
  votes: number
  createdAt: number
}

export interface TransactionDoc {
  uid: string
  amount: number
  currency: 'dollies' | 'gems'
  reason: string
  createdAt: number
}

/* -------------------------------------------------------------------- social */

export interface FriendRequestDoc {
  id: string
  from: string
  to: string
  fromName: string
  toName: string
  note: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
}

export interface FriendshipDoc {
  id: string
  members: [string, string]
  createdAt: number
  favouriteOf: string[]
}

/** friendLists/{uid}: friend uids, for mutual-friend counts. Server-written. */
export interface FriendListDoc {
  uid: string
  uids: string[]
}

export interface BlockDoc {
  blocker: string
  blocked: string
  createdAt: number
}

export interface ConversationDoc {
  id: string
  members: string[]
  names: Record<string, string>
  /** 'request' until a non-friend recipient accepts. */
  status: 'active' | 'request'
  requestedBy: string | null
  lastMessage: { text: string; type: MessageType; senderId: string; createdAt: number } | null
  unread: Record<string, number>
  typing: Record<string, number>
  updatedAt: number
  createdAt: number
}

/** voice and image are legacy types kept so old messages still render; new messages are text or look. */
export type MessageType = 'text' | 'voice' | 'look' | 'image' | 'system'

export interface ReplyRef {
  id: string
  senderId: string
  senderName: string
  type: MessageType
  text: string
}

export interface MessageDoc {
  id: string
  conversationId: string
  senderId: string
  type: MessageType
  text: string
  replyTo: ReplyRef | null
  voice: { url: string; duration: number; waveform: number[]; mime: string } | null
  look: { name: string; portrait: string | null; outfit: Outfit; summary: string; avatar: AvatarSummary } | null
  image: string | null
  reactions: Record<string, string>
  deletedForAll: boolean
  deliveredTo: string[]
  readBy: string[]
  createdAt: number
}

export type PostKind = 'look' | 'selfie' | 'apartment'

export interface PostDoc {
  id: string
  authorId: string
  authorName: string
  authorPortrait: string | null
  authorAvatar: AvatarSummary
  kind: PostKind
  image: string | null
  caption: string
  outfit: Outfit | null
  likes: number
  comments: number
  createdAt: number
}

export interface CommentDoc {
  id: string
  postId: string
  authorId: string
  authorName: string
  text: string
  createdAt: number
}

export type NotificationType =
  | 'friend-request'
  | 'friend-accepted'
  | 'message'
  | 'message-request'
  | 'like'
  | 'comment'
  | 'follow'
  | 'promotion'
  | 'visit'
  | 'system'

export interface NotificationDoc {
  id: string
  uid: string
  type: NotificationType
  fromUid: string | null
  fromName: string | null
  text: string
  link: string | null
  read: boolean
  createdAt: number
}

export type ReportTarget = 'profile' | 'message' | 'voice' | 'post' | 'comment'

export interface ReportDoc {
  id: string
  reporter: string
  targetType: ReportTarget
  targetId: string
  targetUid: string
  reason: string
  details: string
  createdAt: number
  status: 'open' | 'reviewed'
}
