import type { CareerId, MiniGameId } from './types'

export interface CareerDef {
  id: CareerId
  name: string
  starter: boolean
  game: MiniGameId
  /** Glam for a perfect level-1 shift. */
  basePay: number
  blurb: string
  /** Title per level, index 0 = level 1. */
  titles: string[]
  /** Sort game vocabulary: two buckets and items for each. */
  sort?: { left: string; right: string; leftItems: string[]; rightItems: string[] }
  /** Order-up vocabulary. */
  tokens?: string[]
}

const t = (...titles: string[]) => titles

export const CAREERS: Record<CareerId, CareerDef> = {
  barista: {
    id: 'barista',
    name: 'Barista',
    starter: true,
    game: 'order-up',
    basePay: 55,
    blurb: 'Pull shots, steam milk, remember everyone’s order.',
    titles: t('Trainee Barista', 'Barista', 'Senior Barista', 'Head Barista', 'Café Manager', 'Café Owner'),
    tokens: ['Espresso', 'Oat milk', 'Caramel', 'Ice', 'Zobo syrup', 'Cinnamon', 'Foam', 'Chocolate'],
  },
  'shop-assistant': {
    id: 'shop-assistant',
    name: 'Shop Assistant',
    starter: true,
    game: 'rush-hour',
    basePay: 55,
    blurb: 'Help customers find their size before they walk out.',
    titles: t('Floor Assistant', 'Sales Associate', 'Senior Associate', 'Visual Merchandiser', 'Store Manager', 'Boutique Owner'),
  },
  receptionist: {
    id: 'receptionist',
    name: 'Receptionist',
    starter: true,
    game: 'sort',
    basePay: 55,
    blurb: 'Route calls, guests and chaos at a Victoria Island office.',
    titles: t('Front Desk Trainee', 'Receptionist', 'Senior Receptionist', 'Office Coordinator', 'Office Manager', 'Chief of Staff'),
    sort: {
      left: 'Urgent',
      right: 'Later',
      leftItems: ['CEO on line 1', 'Courier waiting', 'Meeting in 5', 'Fire drill', 'VIP guest', 'Lost key card'],
      rightItems: ['Newsletter', 'Snack order', 'Plant watering', 'Brochure restock', 'Survey email', 'Parking memo'],
    },
  },
  'junior-stylist': {
    id: 'junior-stylist',
    name: 'Junior Stylist',
    starter: true,
    game: 'match-look',
    basePay: 55,
    blurb: 'Match colours and pieces to the client’s brief.',
    titles: t('Styling Assistant', 'Junior Stylist', 'Stylist', 'Senior Stylist', 'Lead Stylist', 'Creative Director'),
  },
  'social-media-intern': {
    id: 'social-media-intern',
    name: 'Social Media Intern',
    starter: true,
    game: 'snap',
    basePay: 55,
    blurb: 'Catch the perfect moment for the brand account.',
    titles: t('Intern', 'Content Assistant', 'Social Media Executive', 'Social Lead', 'Head of Social', 'Brand Director'),
  },
  'event-organiser': {
    id: 'event-organiser',
    name: 'Event Organiser',
    starter: false,
    game: 'sort',
    basePay: 85,
    blurb: 'Book the DJ, chase the vendors, pack the venue.',
    titles: t('Runner', 'Event Assistant', 'Event Planner', 'Producer', 'Head of Events', 'Party Mogul'),
    sort: {
      left: 'Book it',
      right: 'Skip it',
      leftItems: ['Rooftop with a view', 'DJ with a following', 'Caterer with reviews', 'Generator backup', 'Security team', 'Photo booth'],
      rightItems: ['Venue with no toilets', 'Unpaid vendor', 'Double-booked hall', 'DJ who cancels', 'No permit', 'Rain-only rooftop'],
    },
  },
  'fashion-designer': {
    id: 'fashion-designer',
    name: 'Fashion Designer',
    starter: false,
    game: 'match-look',
    basePay: 80,
    blurb: 'Sketch, drape, show. From sample room to fashion week.',
    titles: t('Design Intern', 'Assistant Designer', 'Designer', 'Senior Designer', 'Head Designer', 'Label Founder'),
  },
  model: {
    id: 'model',
    name: 'Model',
    starter: false,
    game: 'snap',
    basePay: 80,
    blurb: 'Castings, campaigns, then the runway.',
    titles: t('New Face', 'Catalogue Model', 'Editorial Model', 'Campaign Model', 'Runway Star', 'Supermodel'),
  },
  musician: {
    id: 'musician',
    name: 'Musician',
    starter: false,
    game: 'rhythm',
    basePay: 80,
    blurb: 'Studio sessions to sold-out arenas.',
    titles: t('Bedroom Artist', 'Session Player', 'Opening Act', 'Headliner', 'Chart Topper', 'Afrobeats Legend'),
  },
  actor: {
    id: 'actor',
    name: 'Actor',
    starter: false,
    game: 'snap',
    basePay: 80,
    blurb: 'Auditions, Nollywood sets and red carpets.',
    titles: t('Extra', 'Bit Part', 'Supporting Actor', 'Lead Actor', 'Box Office Star', 'Icon'),
  },
  photographer: {
    id: 'photographer',
    name: 'Photographer',
    starter: false,
    game: 'snap',
    basePay: 80,
    blurb: 'Hit the shutter at exactly the right time.',
    titles: t('Assistant', 'Event Photographer', 'Fashion Photographer', 'Editorial Photographer', 'Studio Owner', 'Legend Lens'),
  },
  'makeup-artist': {
    id: 'makeup-artist',
    name: 'Makeup Artist',
    starter: false,
    game: 'match-look',
    basePay: 75,
    blurb: 'Match shades perfectly for every skin tone.',
    titles: t('Trainee MUA', 'Makeup Artist', 'Bridal MUA', 'Celebrity MUA', 'Beauty Director', 'Beauty Brand Founder'),
  },
  'hair-stylist': {
    id: 'hair-stylist',
    name: 'Hair Stylist',
    starter: false,
    game: 'order-up',
    basePay: 75,
    blurb: 'Braids, silk presses, frontals, all day.',
    titles: t('Salon Assistant', 'Braider', 'Stylist', 'Senior Stylist', 'Salon Manager', 'Salon Owner'),
    tokens: ['Part', 'Detangle', 'Braid', 'Edges', 'Hot water', 'Beads', 'Mousse', 'Silk scarf'],
  },
  influencer: {
    id: 'influencer',
    name: 'Content Creator',
    starter: false,
    game: 'snap',
    basePay: 75,
    blurb: 'Post, engage, collab.',
    titles: t('Micro', 'Rising Creator', 'Creator', 'Top Creator', 'Mega Influencer', 'Cultural Icon'),
  },
  dj: {
    id: 'dj',
    name: 'DJ',
    starter: false,
    game: 'rhythm',
    basePay: 80,
    blurb: 'Keep the floor moving till sunrise.',
    titles: t('Bedroom DJ', 'Bar DJ', 'Club Resident', 'Festival DJ', 'Headline DJ', 'Global DJ'),
  },
  bartender: {
    id: 'bartender',
    name: 'Bartender',
    starter: false,
    game: 'order-up',
    basePay: 70,
    blurb: 'Chapman, cocktails and conversation.',
    titles: t('Barback', 'Bartender', 'Mixologist', 'Head Bartender', 'Bar Manager', 'Bar Owner'),
    tokens: ['Ice', 'Chapman', 'Lime', 'Mint', 'Ginger', 'Soda', 'Bitters', 'Cucumber'],
  },
  chef: {
    id: 'chef',
    name: 'Chef',
    starter: false,
    game: 'order-up',
    basePay: 80,
    blurb: 'Jollof wars are won in the kitchen.',
    titles: t('Kitchen Porter', 'Line Cook', 'Sous Chef', 'Head Chef', 'Executive Chef', 'Restaurateur'),
    tokens: ['Rice', 'Pepper', 'Tomato', 'Onion', 'Plantain', 'Suya spice', 'Chicken', 'Bay leaf'],
  },
  entrepreneur: {
    id: 'entrepreneur',
    name: 'Entrepreneur',
    starter: false,
    game: 'sort',
    basePay: 85,
    blurb: 'Pick the right deals, ignore the noise.',
    titles: t('Side Hustler', 'Founder', 'Seed-Funded', 'Series A', 'Scale-Up CEO', 'Mogul'),
    sort: {
      left: 'Invest',
      right: 'Pass',
      leftItems: ['Growing salon chain', 'Profitable café', 'Fintech with users', 'Fashion brand with orders', 'Logistics app', 'Solar startup'],
      rightItems: ['Ponzi scheme', 'No customers', 'Copycat app', 'Fake reviews', 'Unpaid debts', 'Too good to be true'],
    },
  },
  'software-developer': {
    id: 'software-developer',
    name: 'Software Developer',
    starter: false,
    game: 'sort',
    basePay: 85,
    blurb: 'Ship features, squash bugs.',
    titles: t('Intern Dev', 'Junior Dev', 'Developer', 'Senior Dev', 'Staff Engineer', 'CTO'),
    sort: {
      left: 'Bug',
      right: 'Feature',
      leftItems: ['App crashes on login', 'Button does nothing', 'Wrong total price', 'Page loads forever', 'Typo in error', 'Memory leak'],
      rightItems: ['Dark mode', 'Voice notes', 'Share outfit', 'New filters', 'Profile badges', 'Export data'],
    },
  },
  doctor: {
    id: 'doctor',
    name: 'Doctor',
    starter: false,
    game: 'sort',
    basePay: 90,
    blurb: 'Triage fast, treat well.',
    titles: t('Med Student', 'House Officer', 'Resident', 'Registrar', 'Consultant', 'Chief of Medicine'),
    sort: {
      left: 'Emergency',
      right: 'Clinic',
      leftItems: ['Chest pain', 'Severe bleeding', 'Can’t breathe', 'Unconscious', 'Allergic reaction', 'High fever in baby'],
      rightItems: ['Mild cold', 'Check-up', 'Prescription refill', 'Sprained finger', 'Vaccination', 'Skin rash'],
    },
  },
  lawyer: {
    id: 'lawyer',
    name: 'Lawyer',
    starter: false,
    game: 'sort',
    basePay: 90,
    blurb: 'Sort evidence that wins the case.',
    titles: t('Law Student', 'Associate', 'Senior Associate', 'Partner', 'Senior Partner', 'SAN'),
    sort: {
      left: 'Relevant',
      right: 'Irrelevant',
      leftItems: ['Signed contract', 'CCTV footage', 'Bank record', 'Witness statement', 'Email thread', 'Receipt'],
      rightItems: ['Horoscope', 'Gossip blog', 'Lunch menu', 'Meme', 'Weather report', 'Old flyer'],
    },
  },
  artist: {
    id: 'artist',
    name: 'Artist',
    starter: false,
    game: 'match-look',
    basePay: 75,
    blurb: 'Colour theory pays the rent.',
    titles: t('Sketcher', 'Emerging Artist', 'Exhibiting Artist', 'Gallery Artist', 'Collected Artist', 'Master'),
  },
  dancer: {
    id: 'dancer',
    name: 'Dancer',
    starter: false,
    game: 'rhythm',
    basePay: 75,
    blurb: 'Hit every beat.',
    titles: t('Student', 'Backup Dancer', 'Crew Member', 'Lead Dancer', 'Choreographer', 'Dance Icon'),
  },
  'real-estate-agent': {
    id: 'real-estate-agent',
    name: 'Real-Estate Agent',
    starter: false,
    game: 'sort',
    basePay: 85,
    blurb: 'Know a good listing when you see one.',
    titles: t('Trainee Agent', 'Agent', 'Senior Agent', 'Broker', 'Agency Owner', 'Property Mogul'),
    sort: {
      left: 'List it',
      right: 'Reject',
      leftItems: ['Lekki duplex', 'Ikoyi penthouse', 'Yaba studio', 'Beach house', 'Abuja terrace', 'Loft conversion'],
      rightItems: ['Flood zone shack', 'Fake title deed', 'No road access', 'Collapsed roof', 'Disputed land', 'Haunted (allegedly)'],
    },
  },
  'nail-technician': {
    id: 'nail-technician',
    name: 'Nail Technician',
    starter: false,
    game: 'match-look',
    basePay: 70,
    blurb: 'Match the set to the reference photo.',
    titles: t('Nail Trainee', 'Nail Tech', 'Nail Artist', 'Senior Nail Artist', 'Studio Lead', 'Nail Bar Owner'),
  },
  'personal-stylist': {
    id: 'personal-stylist',
    name: 'Personal Stylist',
    starter: false,
    game: 'match-look',
    basePay: 80,
    blurb: 'Dress clients for the moment.',
    titles: t('Assistant', 'Personal Shopper', 'Personal Stylist', 'Celebrity Stylist', 'Style Director', 'Style Icon'),
  },
}

export const CAREER_LIST = Object.values(CAREERS)
export const STARTER_JOBS = CAREER_LIST.filter((c) => c.starter).map((c) => c.id)
export const CAREER_PATHS = CAREER_LIST.filter((c) => !c.starter)

/** XP needed to reach each level; index 0 = level 1. */
export const LEVEL_XP = [0, 120, 360, 800, 1600, 3200]
/** Reputation needed for each promotion; index 0 = level 1. */
export const LEVEL_REP = [0, 10, 30, 70, 140, 260]
export const MAX_LEVEL = LEVEL_XP.length

export function careerTitle(id: CareerId, level: number): string {
  const c = CAREERS[id]
  return c.titles[Math.min(c.titles.length, Math.max(1, level)) - 1]
}

/** Highest level the xp and reputation allow. */
export function levelFor(xp: number, reputation: number): number {
  let level = 1
  for (let i = 1; i < MAX_LEVEL; i++) {
    if (xp >= LEVEL_XP[i] && reputation >= LEVEL_REP[i]) level = i + 1
  }
  return level
}

export function shiftPay(careerId: CareerId, level: number, score: number): { dollies: number; xp: number; reputation: number } {
  const c = CAREERS[careerId]
  const s = Math.max(0, Math.min(100, score)) / 100
  const levelMult = 1 + (level - 1) * 0.35
  return {
    dollies: Math.round(c.basePay * levelMult * (0.3 + 0.7 * s)),
    xp: Math.round(20 + 40 * s),
    reputation: s >= 0.9 ? 4 : s >= 0.7 ? 3 : s >= 0.4 ? 1 : 0,
  }
}
