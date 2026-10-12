import { defaultApartment } from './apartment'
import { avatarSummary, outfitSummary } from './appearance'
import { CATALOG } from './catalog'
import { CITIES, jitteredPlace } from './cities'
import { makeRng } from './demo'
import { starterAppearance } from './starters'
import type { Aesthetic, ApartmentDoc, Appearance, CareerId, DollDoc, NpcProfile, Outfit, PlacedItem, PostDoc, PublicDoll } from './types'

/**
 * The curated resident cast. NPCs are fictional, always labelled as residents,
 * and stored only in publicDolls/dolls (never in users), so they can never be
 * mistaken for player accounts.
 */
export interface NpcDef {
  id: string
  name: string
  username: string
  city: string
  starter: string
  career: CareerId
  level: number
  styleTag: string
  pronouns: string
  bio: string
  aesthetics: Aesthetic[]
  npc: Omit<NpcProfile, 'circle'>
  circle: string[]
  look: (a: Appearance) => void
  /** Catalog brand + template hints to dress them in real shop pieces. */
  wear: { slot: keyof Outfit; brand?: string; template: string }[]
  captions: string[]
}

const NPCS: NpcDef[] = [
  {
    id: 'npc-temi',
    name: 'Temi Adeyemi',
    username: 'temi.styles',
    city: 'Lagos',
    starter: 'ada',
    career: 'personal-stylist',
    level: 4,
    styleTag: 'Fashionista',
    pronouns: 'she/her',
    bio: 'Stylist to half of Lekki. I will fix your fit and your attitude.',
    aesthetics: ['editorial', 'luxury', 'owambe'],
    npc: {
      personality: 'Blunt, generous, always three steps ahead of the trend.',
      lore: 'Started styling cousins for owambes in Surulere, now pulls looks for Afrobeats videos. Secretly keeps every gele she has ever tied.',
      job: 'Celebrity stylist',
      routine: ['Fittings in Ikoyi', 'Fabric run at Balogun', 'Late dinners on the Island'],
      hangouts: ['Lekki Arts Market', 'Balogun Market', 'Ikoyi rooftops'],
      fashion: 'Sharp tailoring, statement gele, gold everything.',
      activity: ['Styled a music video shoot', 'Posted an owambe lookbook', 'Judging Lagos Fashion Week'],
    },
    circle: ['npc-dayo', 'npc-ife', 'npc-zee'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'sew-in', length: 0.8, color: '#1B1214', dye: { mode: 'balayage', color2: '#B07A4A', gloss: 0.6 } }
      a.makeup = { ...a.makeup, lipstick: '#7B1E3B', eyeliner: 'wing', lashes: 'drama', preset: 'full-beat' }
    },
    wear: [
      { slot: 'outerwear', brand: 'meji-meji', template: 'blazer' },
      { slot: 'bottom', brand: 'meji-meji', template: 'trousers' },
      { slot: 'shoes', template: 'heels' },
      { slot: 'earrings', brand: 'owambe-gold', template: 'drops' },
    ],
    captions: ['Tailoring is a love language', 'Saturday owambe, Sunday rest'],
  },
  {
    id: 'npc-dayo',
    name: 'Dayo "Kid Lagos"',
    username: 'kidlagos',
    city: 'Lagos',
    starter: 'tunde',
    career: 'musician',
    level: 2,
    styleTag: 'Street',
    pronouns: 'he/him',
    bio: 'Afro-fusion. Two singles out, one on the way. Studio in Yaba, dreams in Atlanta.',
    aesthetics: ['streetwear', 'y2k'],
    npc: {
      personality: 'Charming, restless, writes hooks in voice notes at 3am.',
      lore: 'Grew up playing keyboard in church, now chasing his first stadium show. Owes Temi a favour for the cover art.',
      job: 'Aspiring musician',
      routine: ['Studio sessions in Yaba', 'Open mics on Thursdays', 'Gym at noon'],
      hangouts: ['Yaba studios', 'The Strip', 'Freedom Park'],
      fashion: 'Oversized tees, cargos, chains, clean sneakers.',
      activity: ['Teased a new single', 'Performed at an open mic', 'Shared a studio fit'],
    },
    circle: ['npc-temi', 'npc-zee'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'twists', length: 0.35, color: '#1B1214', dye: { mode: 'bleached-tips', color2: '#E9C58A', gloss: 0.3 } }
      a.facialHair = { style: 'stubble', color: '#1B1214', density: 0.6 }
    },
    wear: [
      { slot: 'top', brand: 'track-club', template: 'tee' },
      { slot: 'bottom', brand: 'track-club', template: 'cargo' },
      { slot: 'shoes', brand: 'lekki-street', template: 'sneakers' },
      { slot: 'necklace', template: 'chain' },
    ],
    captions: ['New music Friday. Pray for me', 'Studio fit, no sleep'],
  },
  {
    id: 'npc-zee',
    name: 'Zee Okafor',
    username: 'zeeafterdark',
    city: 'Lagos',
    starter: 'imani',
    career: 'event-organiser',
    level: 3,
    styleTag: 'Socialite',
    pronouns: 'she/they',
    bio: 'If there is a party on the Island, I booked the DJ.',
    aesthetics: ['nightlife', 'soft-glam'],
    npc: {
      personality: 'Magnetic, chaotic, remembers everyone’s name.',
      lore: 'Threw her first rave in a Lekki car park. Now runs the guest list for every launch worth attending. Never seen before midday.',
      job: 'Nightlife socialite and event organiser',
      routine: ['Brunch at 2pm', 'Venue walk-throughs', 'Lives on The Strip after dark'],
      hangouts: ['The Strip', 'Landmark Beach', 'Victoria Island lounges'],
      fashion: 'Sequins, cut-outs, heels she can dance in.',
      activity: ['Announced a rooftop party', 'Posted a nightlife look', 'Booked a headline DJ'],
    },
    circle: ['npc-temi', 'npc-dayo', 'npc-kemi'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'lace-front', length: 0.9, color: '#C0392B', dye: { mode: 'root-shadow', color2: '#E0457B', gloss: 0.8 } }
      a.makeup = { ...a.makeup, lipstick: '#A0153E', look: 'glitter', eyeshadow: '#FF2E88', preset: 'y2k' }
    },
    wear: [
      { slot: 'dress', brand: 'afterhours-eko', template: 'mini-dress' },
      { slot: 'shoes', brand: 'afterhours-eko', template: 'heels' },
      { slot: 'bag', brand: 'afterhours-eko', template: 'clutch' },
    ],
    captions: ['The Strip was loud tonight', 'Guest list closes at 10'],
  },
  {
    id: 'npc-kemi',
    name: 'Kemi Bakare',
    username: 'kemi.noir',
    city: 'Lagos',
    starter: 'kemi',
    career: 'artist',
    level: 3,
    styleTag: 'Alté',
    pronouns: 'they/them',
    bio: 'Painter. Thrifter. Goth in 34 degrees heat and thriving.',
    aesthetics: ['goth', 'alt', 'editorial'],
    npc: {
      personality: 'Quiet, dry humour, unexpectedly sentimental.',
      lore: 'Paints murals of Lagos danfo buses at night. Runs an underground zine about alt fashion in West Africa.',
      job: 'Underground fashion enthusiast and painter',
      routine: ['Thrift hunts at Yaba market', 'Painting until sunrise', 'Zine meetings on Sundays'],
      hangouts: ['Yaba market', 'Arts District galleries', 'Freedom Park'],
      fashion: 'Black lace, platform boots, silver chains.',
      activity: ['Dropped a new zine issue', 'Thrifted a full look for 3k', 'Painted a mural'],
    },
    circle: ['npc-zee', 'npc-luc'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'mohawk', color: '#141014' }
      a.makeup = { ...a.makeup, lipstick: '#141014', eyeliner: 'graphic', eyeshadow: '#3B1A2E', preset: 'goth' }
      a.piercings.push({ id: 'npc-kemi-p1', site: 'septum', side: 'center', jewellery: 'ring', metal: 'silver', gem: 'none', size: 0.4 })
    },
    wear: [
      { slot: 'top', brand: 'noir-lagos', template: 'corset' },
      { slot: 'bottom', brand: 'noir-lagos', template: 'maxi-skirt' },
      { slot: 'shoes', brand: 'noir-lagos', template: 'boots' },
    ],
    captions: ['Goth at noon, sweating beautifully', 'Zine issue 4 is out'],
  },
  {
    id: 'npc-ife',
    name: 'Ifeoma "Ife" Nwosu',
    username: 'ife.collects',
    city: 'Abuja',
    starter: 'zainab',
    career: 'entrepreneur',
    level: 4,
    styleTag: 'Old Money',
    pronouns: 'she/her',
    bio: 'Sneaker and streetwear collector. 212 pairs and counting.',
    aesthetics: ['streetwear', 'luxury'],
    npc: {
      personality: 'Competitive, meticulous, a little bit of a show-off.',
      lore: 'Bought her first grail with her first salary. Now flips rare drops between Abuja, London and Atlanta.',
      job: 'Streetwear collector and reseller',
      routine: ['Checks drops at 9am', 'Ships orders at noon', 'Gallery openings at night'],
      hangouts: ['Wuse market', 'Luxury Hills', 'Airport lounges'],
      fashion: 'Rare sneakers, luxury basics, one statement piece.',
      activity: ['Copped a limited drop', 'Hosted a sneaker swap', 'Flew to London'],
    },
    circle: ['npc-temi', 'npc-jordan'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'ponytail', length: 0.7, color: '#1B1214', dye: { mode: 'solid', color2: '#1B1214', gloss: 0.7 } }
    },
    wear: [
      { slot: 'outerwear', brand: 'mercer-luxe', template: 'blazer' },
      { slot: 'bottom', brand: 'hollis-ave', template: 'jeans' },
      { slot: 'shoes', brand: 'brooklyn-block', template: 'sneakers' },
      { slot: 'bag', brand: 'atelier-marais', template: 'tote' },
    ],
    captions: ['Grail number 212', 'Quiet luxury, loud sneakers'],
  },
  {
    id: 'npc-kwame',
    name: 'Kwame Mensah',
    username: 'kwame.frames',
    city: 'Accra',
    starter: 'kofi',
    career: 'photographer',
    level: 3,
    styleTag: 'Creative',
    pronouns: 'he/him',
    bio: 'Golden hour hunter. Shooting the people of Accra.',
    aesthetics: ['minimal', 'editorial'],
    npc: {
      personality: 'Patient, observant, terrible at replying to messages.',
      lore: 'Shot his first campaign on a borrowed camera at Labadi Beach. Dreams of a solo show in Paris.',
      job: 'Fashion photographer',
      routine: ['Sunrise shoots', 'Editing in Osu cafés', 'Beach at golden hour'],
      hangouts: ['Labadi Beach', 'Osu', 'Jamestown'],
      fashion: 'Linen, neutral tones, always a camera strap.',
      activity: ['Shot an editorial', 'Posted a portrait series', 'Scouted a new model'],
    },
    circle: ['npc-amara', 'npc-camille'],
    look: (a) => {
      a.facialHair = { style: 'short-beard', color: '#1B1214', density: 0.8 }
    },
    wear: [
      { slot: 'top', brand: 'adire-indigo', template: 'shirt' },
      { slot: 'bottom', brand: 'yati', template: 'trousers' },
      { slot: 'shoes', template: 'loafers' },
    ],
    captions: ['Golden hour never misses', 'Accra in portraits'],
  },
  {
    id: 'npc-amara',
    name: 'Amara Diallo',
    username: 'amara.walks',
    city: 'Dakar',
    starter: 'nuru',
    career: 'model',
    level: 4,
    styleTag: 'It Girl',
    pronouns: 'she/her',
    bio: 'Runway in Paris, rice in Dakar. Both equally serious.',
    aesthetics: ['editorial', 'minimal'],
    npc: {
      personality: 'Warm, disciplined, laughs with her whole body.',
      lore: 'Scouted at a Dakar market at 19. Splits her year between castings in Paris and her mother’s restaurant.',
      job: 'Runway model',
      routine: ['Castings', 'Pilates at 7am', 'Family dinner on Sundays'],
      hangouts: ['Plateau', 'Paris showrooms', 'Ngor beach'],
      fashion: 'Column dresses, bare skin, one bold earring.',
      activity: ['Walked a couture show', 'Shot a campaign with Kwame', 'Visited home'],
    },
    circle: ['npc-kwame', 'npc-camille'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'buzz', color: '#1B1214' }
      a.makeup = { ...a.makeup, lipstick: '#3E1F1F', highlight: 0.9, preset: 'editorial' }
    },
    wear: [{ slot: 'dress', brand: 'maison-lumiere', template: 'gown' }, { slot: 'shoes', template: 'heels' }, { slot: 'earrings', template: 'hoops' }],
    captions: ['Couture week, day 3', 'Home cooking > catering'],
  },
  {
    id: 'npc-wanjiru',
    name: 'Wanjiru Kamau',
    username: 'wanjiru.beats',
    city: 'Nairobi',
    starter: 'imani',
    career: 'dj',
    level: 3,
    styleTag: 'Baddie',
    pronouns: 'she/her',
    bio: 'Amapiano and gengetone. Find me behind the decks.',
    aesthetics: ['nightlife', 'streetwear'],
    npc: {
      personality: 'Fearless, funny, plays the song you didn’t know you needed.',
      lore: 'Taught herself to mix on a cracked laptop. Now headlines Nairobi rooftops and wants to play The Strip in Lagos.',
      job: 'DJ',
      routine: ['Digging for records', 'Sets on Fridays and Saturdays', 'Sleep until 2pm'],
      hangouts: ['Westlands', 'Rooftop lounges', 'Record shops'],
      fashion: 'Cargo, crop, chunky boots, headphones as jewellery.',
      activity: ['Released a mix', 'Headlined a rooftop', 'Collab with Zee announced'],
    },
    circle: ['npc-zee', 'npc-thandi'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'knotless-braids', length: 1, color: '#1B1214', dye: { mode: 'peekaboo', color2: '#6E2BFF', gloss: 0.4 } }
    },
    wear: [
      { slot: 'top', brand: 'afterhours-eko', template: 'crop' },
      { slot: 'bottom', brand: 'j-bottoms', template: 'cargo' },
      { slot: 'shoes', brand: 'noir-lagos', template: 'boots' },
    ],
    captions: ['Mix 07 is live', 'Nairobi, you were loud'],
  },
  {
    id: 'npc-thandi',
    name: 'Thandi Mokoena',
    username: 'thandi.glam',
    city: 'Johannesburg',
    starter: 'chloe',
    career: 'makeup-artist',
    level: 4,
    styleTag: 'Soft Life',
    pronouns: 'she/her',
    bio: 'Melanin-first makeup artist. Shade matching is my love language.',
    aesthetics: ['soft-glam', 'editorial'],
    npc: {
      personality: 'Gentle, exacting, will fix your brows without asking.',
      lore: 'Built a cult following matching foundation for dark skin. Launching her own palette next season.',
      job: 'Beauty professional',
      routine: ['Bridal bookings at dawn', 'Product testing', 'Teaching masterclasses'],
      hangouts: ['Maboneng', 'Rosebank studios', 'Beauty Studio'],
      fashion: 'Soft neutrals, satin, perfect nails.',
      activity: ['Did a bridal glam', 'Teased her palette', 'Hosted a masterclass'],
    },
    circle: ['npc-wanjiru', 'npc-amara'],
    look: (a) => {
      a.skin.tone = '#5A3420'
      a.hair = { ...a.hair, style: 'natural-updo', color: '#3B2219' }
      a.makeup = { ...a.makeup, lipstick: '#B5651D', blush: '#C96A6A', highlight: 0.8, lipLiner: '#5E2A2A', preset: 'soft-glam' }
    },
    wear: [{ slot: 'dress', brand: 'bolapsd', template: 'midi-dress' }, { slot: 'shoes', template: 'sandals' }],
    captions: ['Shade 18 for the win', 'Bridal glam, 5am call'],
  },
  {
    id: 'npc-jordan',
    name: 'Jordan Ellis',
    username: 'jordan.atl',
    city: 'Atlanta',
    starter: 'jaylen',
    career: 'influencer',
    level: 4,
    styleTag: 'Influencer',
    pronouns: 'he/they',
    bio: 'Atlanta content creator. Fits, food and Afrobeats reviews.',
    aesthetics: ['streetwear', 'y2k'],
    npc: {
      personality: 'Loud in the best way, hypes everyone up.',
      lore: 'Went viral reviewing Lagos jollof from an Atlanta kitchen. Now plans a trip to Detty December.',
      job: 'Content creator',
      routine: ['Filming at 11am', 'Thrift runs', 'Live streams at night'],
      hangouts: ['Atlantic Station', 'Little Five Points', 'Record shops'],
      fashion: 'Denim sets, bold colour, rare sneakers.',
      activity: ['Posted a fit check', 'Reviewed a new Afrobeats album', 'Booked a Lagos trip'],
    },
    circle: ['npc-ife', 'npc-dayo'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'cornrows', color: '#1B1214' }
      a.facialHair = { style: 'goatee', color: '#1B1214', density: 0.7 }
    },
    wear: [
      { slot: 'outerwear', brand: 'track-club', template: 'jacket' },
      { slot: 'bottom', brand: 'track-club', template: 'jeans' },
      { slot: 'shoes', brand: 'courtside', template: 'sneakers' },
    ],
    captions: ['Fit check: denim on denim', 'Detty December, I’m coming'],
  },
  {
    id: 'npc-camille',
    name: 'Camille Laurent',
    username: 'camille.atelier',
    city: 'Paris',
    starter: 'chloe',
    career: 'fashion-designer',
    level: 5,
    styleTag: 'Fashionista',
    pronouns: 'she/her',
    bio: 'Designer. Martinican roots, Parisian training, Lagos inspiration.',
    aesthetics: ['editorial', 'luxury'],
    npc: {
      personality: 'Precise, romantic, allergic to fast fashion.',
      lore: 'Trained at a couture house, then left to start her own label mixing adire with French tailoring.',
      job: 'Fashion designer',
      routine: ['Atelier from 8am', 'Fabric fairs', 'Café sketches'],
      hangouts: ['Le Marais', 'Paris showrooms', 'Lagos Fashion Week'],
      fashion: 'Sculpted tailoring, indigo dyes, gold hardware.',
      activity: ['Previewed a new collection', 'Collab with Temi rumoured', 'Visited Abeokuta dyers'],
    },
    circle: ['npc-amara', 'npc-kwame', 'npc-temi'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'fringe-bob', color: '#1B1214' }
      a.makeup = { ...a.makeup, lipstick: '#B00020', preset: 'editorial' }
    },
    wear: [
      { slot: 'top', brand: 'rive-gauche', template: 'blouse' },
      { slot: 'bottom', brand: 'adire-indigo', template: 'trousers' },
      { slot: 'shoes', brand: 'rive-gauche', template: 'loafers' },
    ],
    captions: ['Adire meets Paris', 'Collection preview, shhh'],
  },
  {
    id: 'npc-luc',
    name: 'Luca Silva',
    username: 'luca.rio',
    city: 'Rio de Janeiro',
    starter: 'remy',
    career: 'dancer',
    level: 3,
    styleTag: 'Creative',
    pronouns: 'he/they',
    bio: 'Dancer and choreographer. Baile funk with an Afrobeats accent.',
    aesthetics: ['alt', 'streetwear'],
    npc: {
      personality: 'Playful, flirty, rehearses in public.',
      lore: 'Mixes baile funk with Lagos street dance after a summer exchange in Lagos. Pen pals with Kemi.',
      job: 'Dancer and choreographer',
      routine: ['Beach rehearsals', 'Teaching classes', 'Street battles at night'],
      hangouts: ['Copacabana', 'Lapa', 'Dance studios'],
      fashion: 'Mesh, shorts, chunky trainers.',
      activity: ['Posted a choreo', 'Won a dance battle', 'Started a class'],
    },
    circle: ['npc-kemi', 'npc-wanjiru'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'shaved-sides', color: '#2A1A14', dye: { mode: 'gradient-ends', color2: '#C8FF3D', gloss: 0.3 } }
    },
    wear: [
      { slot: 'top', brand: 'courtside', template: 'tank' },
      { slot: 'bottom', brand: 'courtside', template: 'shorts' },
      { slot: 'shoes', brand: 'courtside', template: 'sneakers' },
    ],
    captions: ['New choreo dropping', 'Lapa on a Friday'],
  },
  {
    id: 'npc-sade',
    name: 'Sade Williams',
    username: 'sade.ldn',
    city: 'London',
    starter: 'zainab',
    career: 'software-developer',
    level: 3,
    styleTag: 'Boss',
    pronouns: 'she/her',
    bio: 'Builds fintech by day, collects corsets by night. Peckham ↔ Lagos.',
    aesthetics: ['minimal', 'goth'],
    npc: {
      personality: 'Wry, logical, secretly a hopeless romantic.',
      lore: 'Moved from Lagos to Peckham at 10. Codes payment apps and moonlights as a goth club regular.',
      job: 'Software developer',
      routine: ['Stand-up at 9:30', 'Gym at lunch', 'Goth night on Thursdays'],
      hangouts: ['Peckham', 'Shoreditch clubs', 'Brixton market'],
      fashion: 'Office minimal by day, corsets and boots by night.',
      activity: ['Shipped a feature', 'Went to goth night', 'Planned a Lagos trip'],
    },
    circle: ['npc-kemi', 'npc-ife'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'box-braids', length: 0.9, color: '#1B1214' }
      a.makeup = { ...a.makeup, lipstick: '#3E1F1F', preset: 'clean-girl' }
    },
    wear: [{ slot: 'top', brand: 'noir-lagos', template: 'corset' }, { slot: 'bottom', brand: 'j-bottoms', template: 'trousers' }, { slot: 'shoes', template: 'boots' }],
    captions: ['Merge request approved, now corsets', 'Goth night Thursday'],
  },
  {
    id: 'npc-mina',
    name: 'Mina Sato',
    username: 'mina.kawaii',
    city: 'Tokyo',
    starter: 'remy',
    career: 'nail-technician',
    level: 3,
    styleTag: 'It Girl',
    pronouns: 'she/they',
    bio: 'Nail art and kawaii chaos. Ankara nail sets are my bestseller.',
    aesthetics: ['kawaii', 'y2k'],
    npc: {
      personality: 'Bubbly, detail-obsessed, collects charms.',
      lore: 'Discovered Ankara prints on a trip to London and made them into nail sets. Has a waitlist of 400.',
      job: 'Nail technician',
      routine: ['Salon from 11am', 'Charm shopping in Harajuku', 'Late-night anime'],
      hangouts: ['Harajuku', 'Shibuya', 'Beauty Studio'],
      fashion: 'Pastels, platforms, bows everywhere.',
      activity: ['Posted an Ankara nail set', 'Restocked charms', 'Started a waitlist'],
    },
    circle: ['npc-thandi', 'npc-jordan'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'puffs', color: '#FF8FD8', accessories: ['bows'], accessoryColor: '#FFFFFF' }
      a.makeup = { ...a.makeup, blush: '#FF9E80', blushAmount: 0.7, lipstick: '#E8A0A0', preset: 'kawaii' }
      a.nails = { ...a.nails, pattern: 'ankara', length: 0.8, color: '#FF8FD8' }
    },
    wear: [{ slot: 'top', brand: 'sugar-rush', template: 'crop' }, { slot: 'bottom', brand: 'sugar-rush', template: 'mini-skirt' }, { slot: 'shoes', brand: 'sugar-rush', template: 'sandals' }],
    captions: ['Ankara nails, round two', 'Bows are a personality'],
  },
  {
    id: 'npc-chidi',
    name: 'Chidi Eze',
    username: 'chidi.chef',
    city: 'Port Harcourt',
    starter: 'mathieu',
    career: 'chef',
    level: 4,
    styleTag: 'Boss',
    pronouns: 'he/him',
    bio: 'Chef. Pepper soup scientist. Opening my first spot in GRA.',
    aesthetics: ['minimal', 'owambe'],
    npc: {
      personality: 'Warm, proud, feeds everyone who walks in.',
      lore: 'Learned to cook from his grandmother in Owerri, trained in Lyon, came home to open a restaurant.',
      job: 'Chef and restaurateur',
      routine: ['Market at dawn', 'Prep all afternoon', 'Service until midnight'],
      hangouts: ['Mile 1 market', 'GRA', 'His kitchen'],
      fashion: 'Crisp kaftans off duty, whites on the line.',
      activity: ['Previewed a tasting menu', 'Posted a kaftan fit', 'Hosted a supper club'],
    },
    circle: ['npc-ife', 'npc-temi'],
    look: (a) => {
      a.skin.tone = '#5E3A26'
      a.hair = { ...a.hair, style: 'taper', color: '#1B1214' }
      a.facialHair = { style: 'full-beard', color: '#1B1214', density: 0.9 }
    },
    wear: [{ slot: 'dress', brand: 'eko-thread', template: 'kaftan' }, { slot: 'shoes', brand: 'eko-thread', template: 'loafers' }],
    captions: ['Supper club Saturday', 'Pepper soup, but make it fine dining'],
  },
  {
    id: 'npc-nia',
    name: 'Nia Thompson',
    username: 'nia.nyc',
    city: 'New York',
    starter: 'sage',
    career: 'actor',
    level: 3,
    styleTag: 'Creative',
    pronouns: 'they/them',
    bio: 'Off-Broadway actor. Auditions by day, vintage hunting by night.',
    aesthetics: ['alt', 'editorial'],
    npc: {
      personality: 'Dramatic, kind, quotes plays at dinner.',
      lore: 'Nigerian-Jamaican New Yorker who just booked their first Nollywood co-production.',
      job: 'Actor',
      routine: ['Auditions', 'Rehearsals', 'Vintage stores in the East Village'],
      hangouts: ['East Village', 'Harlem', 'Off-Broadway theatres'],
      fashion: 'Vintage blazers, thrifted finds, one loud accessory.',
      activity: ['Booked a role', 'Thrifted a 70s jumpsuit', 'Rehearsed lines'],
    },
    circle: ['npc-jordan', 'npc-sade'],
    look: (a) => {
      a.hair = { ...a.hair, style: 'afro', volume: 0.9, color: '#3B2219', dye: { mode: 'ombre', color2: '#B07A4A', gloss: 0.3 } }
    },
    wear: [{ slot: 'dress', brand: 'vintage-vault', template: 'jumpsuit' }, { slot: 'shoes', brand: 'vintage-vault', template: 'boots' }, { slot: 'eyewear', template: 'glasses' }],
    captions: ['Booked it!', '70s jumpsuit, $12'],
  },
]

export const NPC_DEFS = NPCS
export const NPC_BY_ID = new Map(NPCS.map((n) => [n.id, n]))

function pickItem(rand: () => number, w: NpcDef['wear'][number]): string | undefined {
  const pool = CATALOG.filter((i) => i.template === w.template && (!w.brand || i.brandId === w.brand))
  const any = pool.length ? pool : CATALOG.filter((i) => i.template === w.template)
  return any.length ? any[Math.floor(rand() * any.length)].id : undefined
}

/** Fully built NPC appearance (deterministic). Used by the server seed and the globe portrait baker. */
export function npcAppearance(def: NpcDef): Appearance {
  const rand = makeRng([...def.id].reduce((h, c) => h * 31 + c.charCodeAt(0), 7))
  const a = starterAppearance(def.starter)
  def.look(a)
  const outfit: Outfit = {}
  for (const w of def.wear) {
    const id = pickItem(rand, w)
    if (id) outfit[w.slot] = id
  }
  a.outfit = outfit
  return a
}

export interface NpcWorld {
  publicDolls: PublicDoll[]
  dolls: DollDoc[]
  apartments: ApartmentDoc[]
  posts: PostDoc[]
}

export function generateNpcWorld(now: number): NpcWorld {
  const out: NpcWorld = { publicDolls: [], dolls: [], apartments: [], posts: [] }
  const furniture = CATALOG.filter((i) => i.furniture && i.furniture.mount !== 'wall' && i.price < 320)
  NPCS.forEach((def, idx) => {
    const rand = makeRng(1000 + idx * 17)
    const a = npcAppearance(def)
    const city = CITIES.find((c) => c.name === def.city) ?? CITIES[0]
    const fame = 300 + Math.floor(rand() * 3000)
    const online = rand() < 0.5
    const pub: PublicDoll = {
      uid: def.id,
      kind: 'npc',
      name: def.name,
      username: def.username,
      bio: def.bio,
      aesthetics: def.aesthetics,
      badges: ['Resident'],
      privacy: { showLocation: true, showOnline: true, dms: 'everyone' },
      npc: { ...def.npc, circle: def.circle },
      portrait: null,
      avatar: avatarSummary(a),
      ...jitteredPlace(city, rand),
      career: def.career,
      careerLevel: def.level,
      styleTag: def.styleTag,
      outfitSummary: outfitSummary(a.outfit),
      pronouns: def.pronouns,
      fame,
      followers: Math.floor(fame / 4),
      following: 40 + Math.floor(rand() * 200),
      friendCount: def.circle.length,
      online,
      lastActive: online ? now : now - Math.floor(rand() * 2 * 86400000),
      lastPostAt: now - Math.floor(rand() * 86400000),
      createdAt: now - 90 * 86400000,
    }
    out.publicDolls.push(pub)
    out.dolls.push({ uid: def.id, name: def.name, appearance: a, hairLooks: [], complexionPresets: [], facePresets: [], updatedAt: now })

    const apt = defaultApartment(def.id, now)
    apt.wallColor = ['#F4F0EA', '#F5D4DA', '#E6E2EA', '#1C171E'][idx % 4]
    apt.floor = (['oak', 'walnut', 'marble', 'tile', 'carpet'] as const)[idx % 5]
    const items: PlacedItem[] = []
    const spots: [number, number][] = [[-1.8, -1.8], [1.8, -1.8], [0, 0.4], [-1.8, 1.5], [1.6, 1.6]]
    for (const [x, z] of spots) items.push({ id: `${def.id}-f${items.length}`, itemId: furniture[Math.floor(rand() * furniture.length)].id, x, z, rot: 0 })
    apt.items = items
    apt.luggage = []
    apt.movedIn = true
    out.apartments.push(apt)

    def.captions.forEach((caption, k) => {
      out.posts.push({
        id: `${def.id}-post-${k}`,
        authorId: def.id,
        authorName: def.name,
        authorPortrait: null,
        authorAvatar: pub.avatar,
        kind: 'look',
        image: null,
        caption,
        outfit: a.outfit,
        likes: 20 + Math.floor(rand() * 300),
        comments: 0,
        createdAt: pub.lastPostAt - k * 86400000,
      })
    })
  })
  return out
}
