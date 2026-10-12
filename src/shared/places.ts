/** Real Lagos spots, re-imagined for DollScene. Positions are on the 3D map (x, z). */
export type PlaceKind = 'date' | 'hangout' | 'runway' | 'market' | 'party'

export interface Place {
  id: string
  name: string
  area: string
  blurb: string
  kind: PlaceKind
  pos: [number, number]
  /** Accent colour for the pin and building. */
  color: string
  /** Which building to draw. */
  model: 'tower' | 'bridge-link' | 'theatre' | 'canopy' | 'beach' | 'market' | 'gallery' | 'square' | 'rooftop' | 'runway' | 'park' | 'club' | 'boat'
  dates: boolean
}

export const PLACES: Place[] = [
  { id: 'eko-atlantic', name: 'Eko Atlantic', area: 'Victoria Island', blurb: 'Glass towers on reclaimed land. The DollScene Runway lives here.', kind: 'runway', pos: [-3.6, 3.2], color: '#FF2E88', model: 'runway', dates: false },
  { id: 'landmark-beach', name: 'Landmark Beach', area: 'Oniru', blurb: 'Cabanas, jollof by the water and sunset playlists.', kind: 'date', pos: [-0.8, 3.8], color: '#F5D06F', model: 'beach', dates: true },
  { id: 'lekki-bridge', name: 'Lekki–Ikoyi Link Bridge', area: 'Ikoyi', blurb: 'Night walks under the lights. Very romantic, very windy.', kind: 'date', pos: [0.6, 0.4], color: '#C7CAD1', model: 'bridge-link', dates: true },
  { id: 'lekki-conservation', name: 'Lekki Conservation Centre', area: 'Lekki', blurb: 'The canopy walkway, monkeys and a lot of nerve.', kind: 'date', pos: [4.6, 1.6], color: '#3CB371', model: 'canopy', dates: true },
  { id: 'nike-gallery', name: 'Nike Art Gallery', area: 'Lekki', blurb: 'Five floors of art. Perfect first date, perfect fit pics.', kind: 'hangout', pos: [3.2, -0.6], color: '#E8505B', model: 'gallery', dates: true },
  { id: 'national-theatre', name: 'National Theatre', area: 'Iganmu', blurb: 'The famous hat-shaped icon. Shows, premieres, owambes.', kind: 'hangout', pos: [-4.2, -2.6], color: '#A86BFF', model: 'theatre', dates: true },
  { id: 'balogun', name: 'Balogun Market', area: 'Lagos Island', blurb: 'Fabric, gele, chaos. Stylists come here first.', kind: 'market', pos: [-1.6, -1.2], color: '#FF6B2C', model: 'market', dates: false },
  { id: 'freedom-park', name: 'Freedom Park', area: 'Lagos Island', blurb: 'Open-air gigs, poetry nights and art fairs.', kind: 'hangout', pos: [-2.4, 0.4], color: '#00A88F', model: 'park', dates: true },
  { id: 'tbs', name: 'Tafawa Balewa Square', area: 'Lagos Island', blurb: 'Concerts, parades and Detty December.', kind: 'hangout', pos: [-0.6, -2.6], color: '#3D7BFF', model: 'square', dates: false },
  { id: 'owambe-vi', name: 'Owambe on the Island', area: 'Victoria Island', blurb: 'Aso ebi, small chops, money spraying. Dress to be photographed.', kind: 'party', pos: [-2.1, 2.7], color: '#FFB800', model: 'club', dates: false },
  { id: 'lagoon-boat-party', name: 'Lagoon Boat Party', area: 'Five Cowries Creek', blurb: 'A yacht, a DJ and the skyline sliding past.', kind: 'party', pos: [0.4, -1.9], color: '#00C2FF', model: 'boat', dates: false },
  { id: 'lekki-club-night', name: 'Club Night, Lekki', area: 'Lekki Phase 1', blurb: 'Afrobeats till 4am. Bottle parade optional.', kind: 'party', pos: [5.9, 0.3], color: '#B14CFF', model: 'club', dates: false },
  { id: 'lfw-tent', name: 'Fashion Week Tent', area: 'Federal Palace, VI', blurb: 'The second runway: designer drops, front row, flashbulbs.', kind: 'runway', pos: [-4.6, 0.9], color: '#FF8CC4', model: 'runway', dates: false },
  { id: 'ikoyi-rooftop', name: 'Ikoyi Rooftop Lounge', area: 'Ikoyi', blurb: 'Golden hour drinks, then the city glows.', kind: 'date', pos: [1.8, -2.2], color: '#C8FF3D', model: 'rooftop', dates: true },
]

export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]))
export const OUTING_REWARD = 30

/** Party rewards: once per party per day. */
export const PARTY_REWARD = 40

/** DollScene is just dates and runways: the spots you can take someone, and the catwalks. */
export const SCENE_SPOTS: Place[] = PLACES.filter((p) => p.kind === 'runway' || p.dates)
