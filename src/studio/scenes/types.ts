export type SceneId = 'prom2016' | 'wedding' | 'rave' | 'fall' | 'beach' | 'rooftop' | 'moviefest' | 'cinema' | 'halloween'
export type TimeOfDay = 'morning' | 'golden' | 'night'
export type Weather = 'clear' | 'breeze' | 'rain' | 'snow' | 'fog' | 'leaves'
export type V3 = [number, number, number]

export interface PhotoSpot {
  id: string
  name: string
  position: V3
  rotationY: number
}

export interface SceneDef {
  id: SceneId
  name: string
  /** One evocative sentence. */
  blurb: string
  dressCode: string
  atmosphere: string
  times: TimeOfDay[]
  defaultTime: TimeOfDay
  weathers: Weather[]
  defaultWeather: Weather
  /** Hex colours for the UI card. */
  accent: string
  accent2: string
  /** '/scenes/<id>.webp' */
  thumbnail: string
  /** 2–4 per scene; the character stands at position, facing rotationY (0 = +Z, towards the default camera). */
  photoSpots: PhotoSpot[]
}

/** What every scene component receives (already validated against its SceneDef). */
export interface SceneProps {
  time: TimeOfDay
  weather: Weather
  animate: boolean
  /** World position of the active photo spot (where the character stands). */
  spot: V3
}
