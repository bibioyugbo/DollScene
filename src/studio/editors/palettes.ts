/** Shade ranges per makeup layer, chosen to work across the whole tone range. */
export const PALETTES = {
  contour: ['#2A1712', '#36201A', '#3E2418', '#4A2D20', '#5A3828', '#6E4632', '#7E5640', '#8E6A54'],
  blush: ['#7A2E3A', '#8E2E5A', '#9E4A44', '#A6503F', '#A8424A', '#B0505A', '#C0605A', '#D07A6A', '#C24E2E', '#E08A7A'],
  highlight: ['#F6D7B0', '#F0CF95', '#EBC593', '#E6C29A', '#F4E4CC', '#E8C7A0', '#D9A066', '#F2D8D8'],
  eyeshadow: ['#2A1A14', '#4A2D20', '#5A3A2A', '#6B3E26', '#8A5A3A', '#B8862F', '#C0905A', '#4A1846', '#6A2E6A', '#1F3FB0', '#1E5A4A', '#7A1F2B', '#B03A2E', '#D4A0A0', '#1A1A1A', '#E8D8C8'],
  liner: ['#050505', '#0C0808', '#2A1A14', '#4A2D20', '#1F3FB0', '#1E5A4A', '#4A1846', '#E8E0D8'],
  lip: ['#3A0E1E', '#5A1E26', '#6A1E3E', '#7A1F2B', '#8C2A3A', '#A3203A', '#C0283A', '#D2452F', '#7A3A34', '#8A4A3A', '#9A5A48', '#B07060', '#C08A78', '#5A3428', '#3A2420', '#C24E7A'],
  lipLiner: ['#2A1210', '#3A1424', '#4A2220', '#4A2620', '#5A1E26', '#6A3A30', '#7A4A3A', '#8A2A3A'],
  brow: ['#0C0808', '#1C1210', '#2A1A12', '#3A2418', '#5A3A24', '#7A5A3A', '#9A7A5A', '#3A3030'],
  hair: ['#0E0B0B', '#141010', '#1E1410', '#2A1A12', '#3A2418', '#5A3A24', '#7A4A2A', '#A0683A', '#C89A5A', '#E0C08A', '#6A1E2A', '#8A2A1E', '#B04A2A', '#C0C0C8', '#2A3A6A', '#5A2A6A'],
  nails: ['#E8D8CC', '#D8B0A0', '#C08A78', '#B0505A', '#7A1F2B', '#3A0E1E', '#0C0808', '#C0283A', '#D2452F', '#E9C46A', '#1F3FB0', '#14D3A0', '#F2D8D8', '#FFFFFF'],
  dye: ['#FFFFFF', '#0C0C0C', '#E8D8C8', '#C08A5A', '#7A1F2B', '#C0283A', '#E9C46A', '#1E5A4A', '#1F3FB0', '#6A2E6A', '#FF6A00', '#14D3A0', '#F2A0B8'],
} as const

/** Foundation and concealer shades follow the skin-tone ladder. */
export { SKIN_TONES } from '../../shared/studio/presets'
