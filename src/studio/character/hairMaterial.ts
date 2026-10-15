import { Color, DoubleSide, Vector3, type MeshStandardMaterial } from 'three'
import { BRAIDED, LOCS, type HairId, type HairLook } from '../../shared/studio/look'

/**
 * The hair "master material": the module's grayscale hair texture tinted from BaseColor at the
 * roots to TipColor at the ends. The fade follows the per-vertex "_tip" attribute (0 root .. 1 tip)
 * written by scripts/character; ColorBlend 0 is a solid colour, 1 starts the fade at the roots.
 * Only "Hair*" materials are tinted: "Accent"/"Bead"/"Satin" (cuffs, beads, the bonnet) keep their
 * own colour.
 *
 * Haircare runs through the same material: wetness (each hair type reacts differently: afros
 * shrink, locs soak and darken, straight hair turns glassy), shampoo foam at the roots,
 * conditioner along the lengths, and section-by-section changes (a braid takedown or a loc
 * retwist) that reveal one module and dissolve the other per scalp section, from the "_section"
 * attribute (0..7) the build writes on every vertex.
 */

/** Hair textures are normalised to luminance 0.62 so a tint reads at its true colour. */
const HAIR_K = 1 / 0.62

export interface HairUniforms {
  uBase: { value: Color }
  uTip: { value: Color }
  uBlend: { value: number }
  /** wet amount, darken, gloss, shrink */
  uWet: { value: [number, number, number, number] }
  uFoam: { value: number }
  uCream: { value: number }
  uDensity: { value: number }
  /** Per scalp section 0..1 progress of a section change. */
  uSections: { value: number[] }
  /** 0 normal, 1 the module being revealed, 2 the module being removed. */
  uSectionMode: { value: number }
  /** 0: change runs from the tips to the roots (takedown); 1: from the roots (retwist). */
  uSectionDir: { value: number }
  uHeadC: { value: Vector3 }
  /** Centre part line (a wig's closure): x on/off, y half-width (m), z mesh units per metre. */
  uPart: { value: [number, number, number, number] }
  /** The scalp showing at the part: her skin tone. */
  uPartColor: { value: Color }
}

/** Styles drawn with a visible centre part showing her scalp (a wig's closure line). */
export const PARTED: readonly string[] = ['long01']

export const isHairMaterial = (m: MeshStandardMaterial) => m.name.startsWith('Hair')

/** How a hair type takes water: [darken, gloss, shrink]. */
export function wetResponse(style: HairId | 'bonnet'): [number, number, number] {
  if (style === 'afro_short' || style === 'afro_big' || style === 'curls' || style === 'braid_out' || style === 'short02') return [0.5, 0.45, 0.14]
  if (LOCS.includes(style as HairId)) return [0.6, 0.22, 0]
  if (BRAIDED.includes(style as HairId) || style === 'bantu_knots') return [0.42, 0.32, 0]
  return [0.38, 0.85, 0]
}

export function setupHairMaterial(mat: MeshStandardMaterial, headC: Vector3): HairUniforms {
  // one set of uniforms per material, for its whole life: the compiled shader holds the set it was
  // compiled with, so a module re-styled for another doll (pooled modules are re-attached and
  // re-styled) must update THESE values, never swap in new objects the GPU never sees
  const had = mat.userData.dsHair as HairUniforms | undefined
  if (had) {
    had.uHeadC.value = headC
    return had
  }
  const uniforms: HairUniforms = {
    uBase: { value: new Color() },
    uTip: { value: new Color() },
    uBlend: { value: 0 },
    uWet: { value: [0, 0, 0, 0] },
    uFoam: { value: 0 },
    uCream: { value: 0 },
    uDensity: { value: 0 },
    uSections: { value: [0, 0, 0, 0, 0, 0, 0, 0] },
    uSectionMode: { value: 0 },
    uSectionDir: { value: 0 },
    uHeadC: { value: headC },
    uPart: { value: [0, 0.0011, 1, 0] },
    uPartColor: { value: new Color() },
  }
  // Opaque cutout: depth writes stay on, so dense styles never show the scalp through a sorted
  // transparent pass, and eyelashes/eyes keep their own blending.
  mat.alphaTest = 0.45
  mat.transparent = false
  mat.depthWrite = true
  mat.side = DoubleSide
  mat.metalness = 0
  mat.color.setScalar(HAIR_K)
  mat.userData.dsHair = uniforms
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float _tip;\nattribute float _section;\nvarying float vTip;\nvarying float vSection;\nvarying vec2 vHairP;\nvarying vec3 vHeadD;\nuniform vec4 uWet;\nuniform vec3 uHeadC;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vTip = _tip;
vSection = _section;
vHairP = transformed.xz * 90.0 + transformed.y * 40.0;
// wet coils shrink toward the head; the part near the scalp stays put
vec3 dsD = transformed - uHeadC;
vHeadD = dsD;
transformed = uHeadC + dsD * (1.0 - uWet.x * uWet.w * smoothstep(0.07, 0.2, length(dsD)));`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uBase; uniform vec3 uTip; uniform float uBlend;
uniform vec4 uWet; uniform float uFoam, uCream, uDensity, uSectionMode, uSectionDir;
uniform float uSections[8];
uniform vec4 uPart; uniform vec3 uPartColor;
varying float vTip; varying float vSection; varying vec2 vHairP; varying vec3 vHeadD;
float dsHashH(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`,
      )
      .replace(
        '#include <alphatest_fragment>',
        `if (uSectionMode > 0.5) {
  int dsS = int(clamp(floor(vSection + 0.5), 0.0, 7.0));
  float dsP = uSections[dsS];
  float dsT = uSectionDir > 0.5 ? vTip : 1.0 - vTip;
  float dsEdge = dsP * 1.08 - 0.04 + (dsHashH(floor(vHairP)) - 0.5) * 0.06;
  bool dsShow = dsT < dsEdge;
  if (uSectionMode < 1.5 ? !dsShow : dsShow) discard;
}
diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + uDensity * 0.8));
#include <alphatest_fragment>`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float dsOmbre = uBlend > 0.001 ? smoothstep(1.0 - uBlend, min(1.0, 1.0 - uBlend + 0.45), vTip) : 0.0;
diffuseColor.rgb *= mix(uBase, uTip, dsOmbre);
diffuseColor.rgb *= 1.0 - uDensity * 0.18 * (1.0 - vTip);
diffuseColor.rgb *= 1.0 - uWet.x * uWet.y;
float dsB = dsHashH(floor(vHairP * 1.7));
float dsFoam = uFoam * (1.0 - smoothstep(0.15, 0.65, vTip)) * (0.7 + 0.3 * dsB);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.97, 1.0), clamp(dsFoam, 0.0, 1.0));
float dsCream = uCream * smoothstep(0.05, 0.35, vTip) * smoothstep(0.3, 0.7, dsHashH(floor(vHairP * vec2(0.6, 3.0))));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.9, 0.86), clamp(dsCream, 0.0, 0.85));
if (uPart.x > 0.5) {
  // the centre part: a thin line of scalp from the front hairline back over the crown, on the
  // top of the head only, widest at the front (where a closure's part sits) and fading at the crown
  vec3 dsHd = vHeadD / uPart.z;
  float dsAlong = smoothstep(-0.05, 0.02, dsHd.z) * smoothstep(0.03, 0.06, dsHd.y);
  float dsW = uPart.y * (0.7 + 0.6 * smoothstep(-0.02, 0.08, dsHd.z));
  float dsLine = (1.0 - smoothstep(dsW * 0.6, dsW, abs(dsHd.x))) * dsAlong * (1.0 - smoothstep(0.0, 0.35, vTip));
  diffuseColor.rgb = mix(diffuseColor.rgb, uPartColor, dsLine);
}`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.12, uWet.x * uWet.z);\nroughnessFactor = mix(roughnessFactor, 0.8, max(dsFoam, dsCream));')
  }
  mat.customProgramCacheKey = () => 'dollscene-hair-v3'
  mat.needsUpdate = true
  return uniforms
}

export function applyHairLook(mat: MeshStandardMaterial, u: HairUniforms, hair: HairLook) {
  u.uBase.value.set(hair.color)
  u.uTip.value.set(hair.tip)
  u.uBlend.value = hair.blend
  // Cards: keep the sheen soft or strands read as plastic bands. Shine lowers roughness and lifts reflections.
  mat.roughness = (0.4 + 0.55 * hair.roughness) * (1 - 0.35 * hair.shine)
  mat.envMapIntensity = 0.25 + 0.9 * hair.shine
}

export interface HairFrame {
  wet: number
  foam: number
  cream: number
  density: number
  response: [number, number, number]
  sections: number[] | null
  mode: 0 | 1 | 2
  dir: 0 | 1
}

/** Per-frame haircare state into the uniforms (no allocation). */
export function applyHairFrame(u: HairUniforms, f: HairFrame) {
  const w = u.uWet.value
  w[0] = f.wet
  w[1] = f.response[0]
  w[2] = f.response[1]
  w[3] = f.response[2]
  u.uFoam.value = f.foam
  u.uCream.value = f.cream
  u.uDensity.value = f.density
  u.uSectionMode.value = f.mode
  u.uSectionDir.value = f.dir
  if (f.sections) for (let i = 0; i < 8; i++) u.uSections.value[i] = f.sections[i] ?? 0
}
