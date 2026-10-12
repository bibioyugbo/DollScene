import { Color, MeshPhysicalMaterial, Vector4, type MeshStandardMaterial, type Texture } from 'three'
import type { StudioLook, Undertone } from '../../shared/studio/look'

/**
 * Skin with real-time layered makeup. The body's base-colour map is a near-white detail
 * map (pores, lips, palms) scaled by 0.72; the player's tone multiplies it. Each makeup
 * layer is painted in the body's UV space through masks baked from the mesh
 * (scripts/character/build_character.py), so blush sits on the cheek of whatever face
 * shape the morphs make, and nothing is a flat overlay on the screen.
 */

export interface SkinMasks {
  faceA: Texture // lips, upper liner, eyelid, blush
  faceB: Texture // contour, highlight, under-eye, brow fill
  faceC: Texture // face (foundation), lip liner, painted scalp hair, lower liner
  body: Texture // nails
}

const LAYERS = ['Foundation', 'Concealer', 'Contour', 'Blush', 'Highlight', 'Shadow', 'Liner', 'LowerLiner', 'LipLiner', 'Lip', 'Brow', 'Scalp', 'Nails'] as const

export type SkinUniforms = Record<`u${(typeof LAYERS)[number]}`, { value: Vector4 }> & {
  uTone: { value: Color }
  uFaceRect: { value: Vector4 }
  uGloss: { value: number }
  uShimmer: { value: number }
  uGlow: { value: number }
  uMaskA: { value: Texture }
  uMaskB: { value: Texture }
  uMaskC: { value: Texture }
  uBodyMask: { value: Texture }
  uHide0: { value: Texture | null }
  uHide1: { value: Texture | null }
  uHideOn: { value: Vector4 }
}

const FRAG_HEAD = /* glsl */ `
uniform vec3 uTone;
uniform vec4 uFaceRect;
uniform float uGloss, uShimmer, uGlow;
uniform sampler2D uMaskA, uMaskB, uMaskC, uBodyMask, uHide0, uHide1;
uniform vec4 uHideOn;
${LAYERS.map((l) => `uniform vec4 u${l};`).join('\n')}
float dsHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
`

const FRAG_LAYERS = /* glsl */ `
if (uHideOn.x > 0.5 && texture2D(uHide0, vMapUv).r > 0.5) discard;
if (uHideOn.y > 0.5 && texture2D(uHide1, vMapUv).r > 0.5) discard;
vec3 dtl = diffuseColor.rgb / 0.72;
float dl = dot(dtl, vec3(0.2126, 0.7152, 0.0722));
vec3 col = uTone * dtl;
vec2 fuv = (vMapUv - uFaceRect.xy) / (uFaceRect.zw - uFaceRect.xy);
vec4 mA = vec4(0.0); vec4 mB = vec4(0.0); vec4 mC = vec4(0.0);
if (fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0) {
  mA = texture2D(uMaskA, fuv); mB = texture2D(uMaskB, fuv); mC = texture2D(uMaskC, fuv);
}
float nailM = smoothstep(0.3, 0.7, texture2D(uBodyMask, vMapUv).r);
// base: foundation evens tone (keeps some texture), concealer brightens under the eye
col = mix(col, uFoundation.rgb * mix(vec3(1.0), dtl, 0.55), mC.r * uFoundation.a * 0.8);
col = mix(col, uConcealer.rgb * mix(vec3(1.0), dtl, 0.5), mB.b * uConcealer.a * 0.85);
// sculpt: contour and blush multiply into the skin (uContour/uBlush hold tint factors)
col = mix(col, col * uContour.rgb, mB.r * uContour.a);
col = mix(col, col * uBlush.rgb, mA.a * uBlush.a * 0.8);
col = mix(col, uBlush.rgb * dl * 0.18, mA.a * uBlush.a * 0.12);
col += (vec3(1.0) - col) * uHighlight.rgb * mB.g * uHighlight.a * 0.32;
// close-cropped hair painted on the scalp
col = mix(col, uScalp.rgb * (0.55 + 0.45 * dl), clamp(mC.b * 1.5, 0.0, 1.0) * uScalp.a);
// brows, eyes
col = mix(col, uBrow.rgb, mB.a * uBrow.a * 0.7);
col = mix(col, uShadow.rgb * mix(1.0, dl, 0.35), mA.b * uShadow.a * 0.92);
float dsLiner = smoothstep(0.12, 0.55, mA.g);
col = mix(col, uLiner.rgb, dsLiner * uLiner.a);
col = mix(col, uLowerLiner.rgb, smoothstep(0.2, 0.6, mC.a) * uLowerLiner.a * 0.85);
// lips
float dsLip = smoothstep(0.08, 0.6, mA.r);
col = mix(col, uLip.rgb * (0.7 + 0.3 * clamp(dl, 0.0, 1.4)), dsLip * uLip.a);
col = mix(col, uLipLiner.rgb, smoothstep(0.12, 0.6, mC.g) * uLipLiner.a * 0.9);
col = mix(col, uNails.rgb, nailM * uNails.a);
diffuseColor.rgb = col;
`

const FRAG_ROUGHNESS = /* glsl */ `
roughnessFactor = 0.6 - uGlow * 0.2;
roughnessFactor = mix(roughnessFactor, 0.07, dsLip * (0.15 + uGloss * 0.85));
roughnessFactor = mix(roughnessFactor, 0.3, mB.g * uHighlight.a);
roughnessFactor = mix(roughnessFactor, 0.3, mA.b * uShadow.a * uShimmer);
roughnessFactor = mix(roughnessFactor, 0.12, nailM * uNails.a);
`

const FRAG_SPARKLE = /* glsl */ `
float dsSp = step(0.993, dsHash(floor(vMapUv * 1600.0)));
totalEmissiveRadiance += (uShadow.rgb + 0.35) * dsSp * mA.b * uShadow.a * uShimmer * 0.45;
totalEmissiveRadiance += uHighlight.rgb * dsSp * mB.g * uHighlight.a * 0.18;
`

const v4 = () => new Vector4(0, 0, 0, 0)

export function createSkinMaterial(src: MeshStandardMaterial, masks: SkinMasks, faceRect: [number, number, number, number]) {
  const [u0, v0, u1, v1] = faceRect
  const uniforms = {
    uTone: { value: new Color() },
    // glTF flips V: Blender v becomes 1 - v.
    uFaceRect: { value: new Vector4(u0, 1 - v1, u1, 1 - v0) },
    uGloss: { value: 0 },
    uShimmer: { value: 0 },
    uGlow: { value: 0.3 },
    uMaskA: { value: masks.faceA },
    uMaskB: { value: masks.faceB },
    uMaskC: { value: masks.faceC },
    uBodyMask: { value: masks.body },
    uHide0: { value: null },
    uHide1: { value: null },
    uHideOn: { value: v4() },
    ...Object.fromEntries(LAYERS.map((l) => [`u${l}`, { value: v4() }])),
  } as SkinUniforms

  const mat = new MeshPhysicalMaterial({
    name: 'Skin',
    map: src.map,
    normalMap: src.normalMap,
    normalScale: src.normalScale.clone().multiplyScalar(0.6),
    roughness: 0.6,
    metalness: 0,
    specularIntensity: 0.5,
    sheen: 0.35,
    sheenRoughness: 0.55,
    sheenColor: new Color('#ffb8a0'),
  })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG_LAYERS}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGHNESS}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_SPARKLE}`)
  }
  mat.customProgramCacheKey = () => 'dollscene-skin-v1'
  return { material: mat, uniforms }
}

/* ------------------------------------------------------------------ look → uniforms */

const tmp = new Color()
const lum = (c: Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b

/** Undertone shifts the chosen tone without changing its depth. */
export function skinColor(tone: string, undertone: Undertone, out = new Color()): Color {
  out.set(tone)
  const hsl = { h: 0, s: 0, l: 0 }
  out.getHSL(hsl)
  const shift = { cool: [-0.018, -0.05], neutral: [0, -0.02], warm: [0.012, 0.04], olive: [0.04, -0.06] }[undertone]
  out.setHSL((hsl.h + shift[0] + 1) % 1, Math.min(1, Math.max(0, hsl.s + shift[1])), hsl.l)
  return out
}

function setLayer(u: { value: Vector4 }, hex: string, amount: number) {
  tmp.set(hex)
  u.value.set(tmp.r, tmp.g, tmp.b, amount)
}

/** Tint factor with a fixed luminance: multiplies the skin toward the colour's hue. */
function setTint(u: { value: Vector4 }, hex: string, amount: number, depth: number) {
  tmp.set(hex)
  const k = depth / Math.max(lum(tmp), 0.004)
  u.value.set(Math.min(tmp.r * k, 1.8), Math.min(tmp.g * k, 1.8), Math.min(tmp.b * k, 1.8), amount)
}

export function applyLookToSkin(u: SkinUniforms, look: StudioLook) {
  const m = look.makeup
  skinColor(look.skin.tone, look.skin.undertone, u.uTone.value)
  u.uGlow.value = look.skin.glow
  setLayer(u.uFoundation, m.foundation.color, m.foundation.amount)
  setLayer(u.uConcealer, m.concealer.color, m.concealer.amount)
  setTint(u.uContour, m.contour.color, m.contour.amount, 0.55)
  setTint(u.uBlush, m.blush.color, m.blush.amount, 1.0)
  setLayer(u.uHighlight, m.highlight.color, m.highlight.amount)
  setLayer(u.uShadow, m.eyeshadow.color, m.eyeshadow.amount)
  u.uShimmer.value = m.eyeshadow.shimmer
  setLayer(u.uLiner, m.liner.color, m.liner.amount)
  setLayer(u.uLowerLiner, m.lowerLiner.color, m.lowerLiner.amount)
  setLayer(u.uLipLiner, m.lipLiner.color, m.lipLiner.amount)
  setLayer(u.uLip, m.lipstick.color, m.lipstick.amount)
  u.uGloss.value = m.gloss
  setLayer(u.uBrow, look.brows.color, 0.55)
  setLayer(u.uScalp, look.hair.color, look.hair.style === 'none' ? look.hair.crop : 0.35)
  setLayer(u.uNails, look.nails.color, look.nails.amount)
}
