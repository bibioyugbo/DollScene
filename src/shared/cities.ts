import type { Place, RegionId } from './types'

export interface City {
  name: string
  country: string
  region: RegionId
  lat: number
  lng: number
}

const c = (name: string, country: string, region: RegionId, lat: number, lng: number): City => ({ name, country, region, lat, lng })

/** City centres only. Players pick a city; we never store real coordinates. */
export const CITIES: City[] = [
  // West Africa
  c('Lagos', 'Nigeria', 'west-africa', 6.524, 3.379),
  c('Abuja', 'Nigeria', 'west-africa', 9.076, 7.398),
  c('Ibadan', 'Nigeria', 'west-africa', 7.378, 3.947),
  c('Port Harcourt', 'Nigeria', 'west-africa', 4.815, 7.049),
  c('Kano', 'Nigeria', 'west-africa', 12.0, 8.517),
  c('Enugu', 'Nigeria', 'west-africa', 6.459, 7.549),
  c('Benin City', 'Nigeria', 'west-africa', 6.335, 5.627),
  c('Abeokuta', 'Nigeria', 'west-africa', 7.145, 3.327),
  c('Calabar', 'Nigeria', 'west-africa', 4.958, 8.322),
  c('Accra', 'Ghana', 'west-africa', 5.603, -0.187),
  c('Kumasi', 'Ghana', 'west-africa', 6.688, -1.624),
  c('Dakar', 'Senegal', 'west-africa', 14.716, -17.467),
  c('Abidjan', "Côte d'Ivoire", 'west-africa', 5.36, -4.008),
  c('Freetown', 'Sierra Leone', 'west-africa', 8.465, -13.231),
  c('Lomé', 'Togo', 'west-africa', 6.137, 1.212),
  c('Cotonou', 'Benin', 'west-africa', 6.366, 2.418),
  c('Douala', 'Cameroon', 'west-africa', 4.051, 9.768),
  // East Africa
  c('Nairobi', 'Kenya', 'east-africa', -1.292, 36.822),
  c('Kampala', 'Uganda', 'east-africa', 0.347, 32.582),
  c('Kigali', 'Rwanda', 'east-africa', -1.944, 30.062),
  c('Addis Ababa', 'Ethiopia', 'east-africa', 9.03, 38.74),
  c('Dar es Salaam', 'Tanzania', 'east-africa', -6.792, 39.208),
  c('Zanzibar', 'Tanzania', 'east-africa', -6.165, 39.202),
  // Southern Africa
  c('Johannesburg', 'South Africa', 'southern-africa', -26.204, 28.047),
  c('Cape Town', 'South Africa', 'southern-africa', -33.925, 18.424),
  c('Durban', 'South Africa', 'southern-africa', -29.858, 31.022),
  c('Harare', 'Zimbabwe', 'southern-africa', -17.825, 31.033),
  c('Lusaka', 'Zambia', 'southern-africa', -15.387, 28.322),
  c('Luanda', 'Angola', 'southern-africa', -8.839, 13.289),
  c('Kinshasa', 'DR Congo', 'southern-africa', -4.441, 15.266),
  // North Africa
  c('Cairo', 'Egypt', 'north-africa', 30.044, 31.236),
  c('Casablanca', 'Morocco', 'north-africa', 33.573, -7.59),
  c('Marrakech', 'Morocco', 'north-africa', 31.629, -7.981),
  c('Tunis', 'Tunisia', 'north-africa', 36.806, 10.181),
  // Europe
  c('London', 'United Kingdom', 'europe', 51.507, -0.128),
  c('Manchester', 'United Kingdom', 'europe', 53.48, -2.242),
  c('Birmingham', 'United Kingdom', 'europe', 52.486, -1.89),
  c('Paris', 'France', 'europe', 48.857, 2.352),
  c('Marseille', 'France', 'europe', 43.296, 5.37),
  c('Berlin', 'Germany', 'europe', 52.52, 13.405),
  c('Amsterdam', 'Netherlands', 'europe', 52.368, 4.904),
  c('Brussels', 'Belgium', 'europe', 50.85, 4.352),
  c('Lisbon', 'Portugal', 'europe', 38.722, -9.139),
  c('Madrid', 'Spain', 'europe', 40.417, -3.704),
  c('Milan', 'Italy', 'europe', 45.464, 9.19),
  c('Dublin', 'Ireland', 'europe', 53.35, -6.26),
  c('Stockholm', 'Sweden', 'europe', 59.329, 18.069),
  // North America
  c('New York', 'United States', 'north-america', 40.713, -74.006),
  c('Atlanta', 'United States', 'north-america', 33.749, -84.388),
  c('Houston', 'United States', 'north-america', 29.76, -95.37),
  c('Los Angeles', 'United States', 'north-america', 34.052, -118.244),
  c('Chicago', 'United States', 'north-america', 41.878, -87.63),
  c('Washington DC', 'United States', 'north-america', 38.907, -77.037),
  c('Miami', 'United States', 'north-america', 25.762, -80.192),
  c('Dallas', 'United States', 'north-america', 32.777, -96.797),
  c('Toronto', 'Canada', 'north-america', 43.653, -79.383),
  c('Montreal', 'Canada', 'north-america', 45.502, -73.567),
  c('Mexico City', 'Mexico', 'north-america', 19.433, -99.133),
  // Caribbean
  c('Kingston', 'Jamaica', 'caribbean', 17.971, -76.793),
  c('Port of Spain', 'Trinidad and Tobago', 'caribbean', 10.66, -61.51),
  c('Bridgetown', 'Barbados', 'caribbean', 13.098, -59.618),
  c('Port-au-Prince', 'Haiti', 'caribbean', 18.594, -72.307),
  c('Santo Domingo', 'Dominican Republic', 'caribbean', 18.486, -69.931),
  // South America
  c('Rio de Janeiro', 'Brazil', 'south-america', -22.907, -43.173),
  c('São Paulo', 'Brazil', 'south-america', -23.551, -46.633),
  c('Salvador', 'Brazil', 'south-america', -12.978, -38.501),
  c('Bogotá', 'Colombia', 'south-america', 4.711, -74.072),
  c('Cartagena', 'Colombia', 'south-america', 10.391, -75.479),
  c('Buenos Aires', 'Argentina', 'south-america', -34.604, -58.382),
  c('Lima', 'Peru', 'south-america', -12.046, -77.043),
  // Middle East
  c('Dubai', 'United Arab Emirates', 'middle-east', 25.205, 55.271),
  c('Doha', 'Qatar', 'middle-east', 25.286, 51.531),
  c('Istanbul', 'Turkey', 'middle-east', 41.008, 28.978),
  c('Riyadh', 'Saudi Arabia', 'middle-east', 24.713, 46.675),
  // Asia
  c('Tokyo', 'Japan', 'asia', 35.676, 139.65),
  c('Seoul', 'South Korea', 'asia', 37.567, 126.978),
  c('Mumbai', 'India', 'asia', 19.076, 72.878),
  c('Delhi', 'India', 'asia', 28.704, 77.102),
  c('Singapore', 'Singapore', 'asia', 1.352, 103.82),
  c('Bangkok', 'Thailand', 'asia', 13.756, 100.502),
  c('Manila', 'Philippines', 'asia', 14.6, 120.984),
  c('Hong Kong', 'China', 'asia', 22.319, 114.169),
  c('Shanghai', 'China', 'asia', 31.23, 121.474),
  // Oceania
  c('Sydney', 'Australia', 'oceania', -33.869, 151.209),
  c('Melbourne', 'Australia', 'oceania', -37.814, 144.963),
  c('Auckland', 'New Zealand', 'oceania', -36.849, 174.763),
]

export const REGION_LABELS: Record<RegionId, string> = {
  'west-africa': 'West Africa',
  'east-africa': 'East Africa',
  'southern-africa': 'Southern & Central Africa',
  'north-africa': 'North Africa',
  europe: 'Europe',
  'north-america': 'North America',
  caribbean: 'Caribbean',
  'south-america': 'South America',
  'middle-east': 'Middle East',
  asia: 'Asia',
  oceania: 'Oceania',
}

/** State, province or region for each city, shown next to the country. */
const STATES: Record<string, string> = {
  Lagos: 'Lagos State',
  Abuja: 'FCT',
  Ibadan: 'Oyo State',
  'Port Harcourt': 'Rivers State',
  Kano: 'Kano State',
  Enugu: 'Enugu State',
  'Benin City': 'Edo State',
  Abeokuta: 'Ogun State',
  Calabar: 'Cross River State',
  Accra: 'Greater Accra',
  Kumasi: 'Ashanti Region',
  Dakar: 'Dakar Region',
  Abidjan: 'Abidjan District',
  Freetown: 'Western Area',
  Lomé: 'Maritime Region',
  Cotonou: 'Littoral',
  Douala: 'Littoral Region',
  Nairobi: 'Nairobi County',
  Kampala: 'Central Region',
  Kigali: 'Kigali City',
  'Addis Ababa': 'Addis Ababa',
  'Dar es Salaam': 'Dar es Salaam Region',
  Zanzibar: 'Zanzibar',
  Johannesburg: 'Gauteng',
  'Cape Town': 'Western Cape',
  Durban: 'KwaZulu-Natal',
  Harare: 'Harare Province',
  Lusaka: 'Lusaka Province',
  Luanda: 'Luanda Province',
  Kinshasa: 'Kinshasa',
  Cairo: 'Cairo Governorate',
  Casablanca: 'Casablanca-Settat',
  Marrakech: 'Marrakech-Safi',
  Tunis: 'Tunis Governorate',
  London: 'England',
  Manchester: 'England',
  Birmingham: 'England',
  Paris: 'Île-de-France',
  Marseille: 'Provence',
  Berlin: 'Berlin',
  Amsterdam: 'North Holland',
  Brussels: 'Brussels-Capital',
  Lisbon: 'Lisbon District',
  Madrid: 'Community of Madrid',
  Milan: 'Lombardy',
  Dublin: 'Leinster',
  Stockholm: 'Stockholm County',
  'New York': 'New York',
  Atlanta: 'Georgia',
  Houston: 'Texas',
  'Los Angeles': 'California',
  Chicago: 'Illinois',
  'Washington DC': 'District of Columbia',
  Miami: 'Florida',
  Dallas: 'Texas',
  Toronto: 'Ontario',
  Montreal: 'Quebec',
  'Mexico City': 'CDMX',
  Kingston: 'Surrey County',
  'Port of Spain': 'Port of Spain',
  Bridgetown: 'St Michael',
  'Port-au-Prince': 'Ouest',
  'Santo Domingo': 'Distrito Nacional',
  'Rio de Janeiro': 'Rio de Janeiro',
  'São Paulo': 'São Paulo',
  Salvador: 'Bahia',
  Bogotá: 'Bogotá DC',
  Cartagena: 'Bolívar',
  'Buenos Aires': 'Buenos Aires',
  Lima: 'Lima Region',
  Dubai: 'Dubai',
  Doha: 'Ad Dawhah',
  Istanbul: 'Istanbul Province',
  Riyadh: 'Riyadh Province',
  Tokyo: 'Tokyo',
  Seoul: 'Seoul',
  Mumbai: 'Maharashtra',
  Delhi: 'Delhi NCT',
  Singapore: 'Central Region',
  Bangkok: 'Bangkok',
  Manila: 'Metro Manila',
  'Hong Kong': 'Hong Kong',
  Shanghai: 'Shanghai',
  Sydney: 'New South Wales',
  Melbourne: 'Victoria',
  Auckland: 'Auckland Region',
}

export function stateOf(city: string): string {
  return STATES[city] ?? ''
}

/** "Lagos, Lagos State, Nigeria"; repeats are dropped ("Tokyo, Japan"). */
export function placeLabel(city: string, country: string): string {
  const parts = [city, stateOf(city), country].filter(Boolean)
  return parts.filter((p, i) => parts.indexOf(p) === i).join(', ')
}

export const COUNTRIES = [...new Set(CITIES.map((x) => x.country))].sort()

export function findCity(name: string, country?: string): City | undefined {
  return CITIES.find((x) => x.name === name && (!country || x.country === country))
}

/**
 * City centre plus a random offset of up to ~12 km so pins never reveal
 * a real address and dolls in one city do not stack exactly.
 */
export function jitteredPlace(city: City, rand: () => number = Math.random): Place {
  const r = 0.11 * Math.sqrt(rand())
  const a = rand() * Math.PI * 2
  return {
    city: city.name,
    country: city.country,
    region: city.region,
    lat: +(city.lat + r * Math.sin(a)).toFixed(3),
    lng: +(city.lng + (r * Math.cos(a)) / Math.max(0.2, Math.cos((city.lat * Math.PI) / 180))).toFixed(3),
  }
}

/** Great-circle distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = Math.PI / 180
  const dLat = (bLat - aLat) * toRad
  const dLng = (bLng - aLng) * toRad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function nearestCity(lat: number, lng: number): City {
  let best = CITIES[0]
  let bestD = Infinity
  for (const x of CITIES) {
    const d = distanceKm(lat, lng, x.lat, x.lng)
    if (d < bestD) {
      bestD = d
      best = x
    }
  }
  return best
}
