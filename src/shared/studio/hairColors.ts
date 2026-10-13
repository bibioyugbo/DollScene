/**
 * Hair colour presets: the "material instances" of the hair shader. Each sets the base colour and
 * suggested shine; ombre (tip colour + blend) stays the player's choice. 'custom' is the picker.
 * Colours are sRGB hex, tuned for the grayscale hair textures (luminance ~0.62) the shader tints.
 */
export interface HairColorPreset {
  id: string
  name: string
  color: string
  shine: number
}

export const HAIR_COLOR_PRESETS: readonly HairColorPreset[] = [
  { id: 'jet_black', name: 'Jet black', color: '#0A0A0C', shine: 0.5 },
  { id: 'natural_black', name: 'Natural black', color: '#141010', shine: 0.35 },
  { id: 'dark_brown', name: 'Dark brown', color: '#3A2418', shine: 0.35 },
  { id: 'chestnut', name: 'Chestnut', color: '#6B3A22', shine: 0.4 },
  { id: 'honey_blonde', name: 'Honey blonde', color: '#B9854A', shine: 0.4 },
  { id: 'platinum_blonde', name: 'Platinum blonde', color: '#E6DCC8', shine: 0.45 },
  { id: 'ginger', name: 'Ginger', color: '#B5552A', shine: 0.4 },
  { id: 'burgundy', name: 'Burgundy', color: '#5E1A26', shine: 0.45 },
  { id: 'red', name: 'Red', color: '#A3202A', shine: 0.45 },
  { id: 'pink', name: 'Pink', color: '#E07AA6', shine: 0.4 },
  { id: 'purple', name: 'Purple', color: '#6A2E8A', shine: 0.45 },
  { id: 'blue', name: 'Blue', color: '#2A4FB0', shine: 0.45 },
  { id: 'teal', name: 'Teal', color: '#1E7A7A', shine: 0.45 },
  { id: 'green', name: 'Green', color: '#2E7A3A', shine: 0.45 },
  { id: 'grey', name: 'Grey', color: '#8C8C90', shine: 0.3 },
  { id: 'white', name: 'White', color: '#F2F0EC', shine: 0.3 },
]

export const hairPreset = (id: string) => HAIR_COLOR_PRESETS.find((p) => p.id === id)
