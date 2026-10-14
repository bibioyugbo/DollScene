import { Color, DataTexture, LinearFilter, MeshPhysicalMaterial, NoColorSpace, RGBAFormat, Vector2, Vector4, type MeshStandardMaterial, type Texture } from 'three'
import { clinicEffect } from '../../shared/studio/clinic'
import { MARKS, SPOT_IDS, type ClinicId, type StudioLook, type Undertone } from '../../shared/studio/look'
import type { CareData } from './catalog'
import type { SkinFx } from '../state/fx'

/**
 * Skin with real-time layered makeup and skincare. The body's base-colour map is a near-white
 * detail map (pores, lips, palms) scaled by 0.72; the player's tone multiplies it. Each makeup
 * layer and every skincare product is painted in the body's UV space through masks baked from
 * the mesh (scripts/character/build_character.py), so blush sits on the cheek of whatever face
 * shape the morphs make, foam lands on the forehead and cheeks, and nothing is a flat overlay on
 * the screen. One shader program, so the whole face costs a single draw.
 */

export interface SkinMasks {
  faceA: Texture // lips, upper liner, eyelid, blush
  faceB: Texture // contour, highlight, under-eye, brow fill
  faceC: Texture // face (foundation), lip liner, painted scalp hair, lower liner
  /** Skincare regions: forehead, cheek L, cheek R, nose (null on older builds). */
  faceD: Texture | null
  /** chin, face perimeter, inner eye corner, brow bone (null on older builds). */
  faceE: Texture | null
  body: Texture // nails
}

const LAYERS = ['Foundation', 'Concealer', 'Corrector', 'Powder', 'Contour', 'Bronzer', 'Blush', 'Highlight', 'Shadow', 'Inner', 'Liner', 'LowerLiner', 'LipLiner', 'Lip', 'LipCentre', 'Brow', 'Scalp', 'Nails'] as const
/** Per-frame skincare amounts per region: D = (forehead, cheekL, cheekR, nose), E = (chin, perimeter, -, -). */
const FX = ['Foam', 'Wet', 'Cream', 'Sheen'] as const
const NSPOT = SPOT_IDS.length

export type SkinUniforms = Record<`u${(typeof LAYERS)[number]}`, { value: Vector4 }> &
  Record<`u${(typeof FX)[number]}${'D' | 'E'}`, { value: Vector4 }> & {
    uTone: { value: Color }
    uFaceRect: { value: Vector4 }
    /** gloss, frost, matte, primer */
    uLipFx: { value: Vector4 }
    uShimmer: { value: number }
    uGlow: { value: number }
    /** finish roughness of the base (matte .. dewy), powder, setting spray, foundation coverage */
    uBase: { value: Vector4 }
    /** under-eye darkness, texture/redness, hydration, lip condition */
    uCare: { value: Vector4 }
    /** eye cream, balm, spf finish, scalp hairline/density boost */
    uCare2: { value: Vector4 }
    /** rash, hyperpigmentation, dry/flaky, dew (just-washed water droplets) */
    uCare3: { value: Vector4 }
    /** live: flakes being scrubbed off (0..1), rash gel on, pigment serum on, sunscreen glow */
    uCare4: { value: Vector4 }
    uLipCentreUv: { value: Vector4 }
    /** mark uv, unused, kind (0 none, 1 mole, 2 birthmark, 3 freckles, 4 vitiligo) */
    uMark: { value: Vector4 }
    uSpotA: { value: Vector4[] }
    uSpotB: { value: Vector4[] }
    uMaskA: { value: Texture }
    uMaskB: { value: Texture }
    uMaskC: { value: Texture }
    uMaskD: { value: Texture | null }
    uMaskE: { value: Texture | null }
    uRegionsOn: { value: number }
    uBodyMask: { value: Texture }
    /** The four slots' hide masks packed in one texture (R top, G bottom, B dress, A shoes): one
     * texture unit instead of four, so the skin stays within 16 (phones) with the tattoo ink. */
    uHide: { value: Texture | null }
    uHideOn: { value: Vector4 }
    /** Tattoo ink in body UV (premultiplied: rgb ink, a coverage); see tattoos.ts. */
    uTattoo: { value: Texture | null }
    /** x: tattoos on, y: fading under a removal laser (0..1), z: freshly inked redness */
    uTattooFx: { value: Vector4 }
  }

const FRAG_HEAD = /* glsl */ `
uniform vec3 uTone;
uniform vec4 uFaceRect;
uniform vec4 uLipFx, uBase, uCare, uCare2, uCare3, uCare4, uLipCentreUv, uMark;
uniform float uShimmer, uGlow, uRegionsOn;
uniform sampler2D uMaskA, uMaskB, uMaskC, uMaskD, uMaskE, uBodyMask, uHide, uTattoo;
uniform vec4 uHideOn, uTattooFx;
uniform vec4 uSpotA[${NSPOT}];
uniform vec4 uSpotB[${NSPOT}];
${LAYERS.map((l) => `uniform vec4 u${l};`).join('\n')}
${FX.map((f) => `uniform vec4 u${f}D; uniform vec4 u${f}E;`).join('\n')}
float dsHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float dsNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dsHash(i), dsHash(i + vec2(1.0, 0.0)), f.x), mix(dsHash(i + vec2(0.0, 1.0)), dsHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
vec3 dsPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surf_pos)); vec3 sy = normalize(dFdy(surf_pos));
  vec3 r1 = cross(sy, surf_norm); vec3 r2 = cross(surf_norm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surf_norm - grad);
}
`

const FRAG_LAYERS = /* glsl */ `
if (dot(uHideOn, vec4(1.0)) > 0.5) {
  vec4 hm = texture2D(uHide, vMapUv);
  if (any(greaterThan(uHideOn * step(0.5, hm), vec4(0.5)))) discard;
}
vec3 dtl = diffuseColor.rgb / 0.72;
float dsH = 0.0;
float dl = dot(dtl, vec3(0.2126, 0.7152, 0.0722));
vec3 col = uTone * dtl;
vec2 fuv = (vMapUv - uFaceRect.xy) / (uFaceRect.zw - uFaceRect.xy);
vec4 mA = vec4(0.0); vec4 mB = vec4(0.0); vec4 mC = vec4(0.0); vec4 mD = vec4(0.0); vec4 mE = vec4(0.0);
if (fuv.x >= 0.0 && fuv.x <= 1.0 && fuv.y >= 0.0 && fuv.y <= 1.0) {
  mA = texture2D(uMaskA, fuv); mB = texture2D(uMaskB, fuv); mC = texture2D(uMaskC, fuv);
  if (uRegionsOn > 0.5) { mD = texture2D(uMaskD, fuv); mE = texture2D(uMaskE, fuv); }
}
float nailM = smoothstep(0.3, 0.7, texture2D(uBodyMask, vMapUv).r);
float dsLip = smoothstep(0.08, 0.6, mA.r);
float faceM = mC.r;

/* ---- skin condition (under the makeup): dark circles, uneven texture and redness ---- */
float tex = uCare.y * (1.0 - uLipFx.w * 0.75);
col *= 1.0 - mB.b * uCare.x * 0.3;
float redZone = clamp(mD.g + mD.b + mD.a * 0.7 + mE.r * 0.6, 0.0, 1.0);
col = mix(col, col * vec3(1.1, 0.86, 0.84), tex * redZone * 0.45);
col *= 1.0 - tex * faceM * 0.09 * dsNoise(vMapUv * 700.0);
// lips: dry and ashy when uncared for
col = mix(col, col * 1.12 + vec3(0.03), dsLip * (1.0 - uCare.w) * 0.25);

/* ---- skin conditions: rash, hyperpigmentation, dry flaky patches (skincare treats each) ---- */
// how deep the tone is (0 very fair .. 1 very deep): redness reads red-pink on fair skin and as a
// deeper red-brown/violet on deep skin; marks darken in proportion; ash and flakes show grey-white
float deep = clamp((0.42 - dot(uTone, vec3(0.2126, 0.7152, 0.0722))) / 0.38, 0.0, 1.0);
float cheeksZone = clamp(mD.g + mD.b + mE.r * 0.8, 0.0, 1.0);
if (uCare3.x > 0.001) {
  // rash: blotchy redness with tiny raised bumps over the cheeks and chin, calmed by gel
  float blotch = smoothstep(0.38, 0.72, dsNoise(vMapUv * 60.0) * 0.6 + dsNoise(vMapUv * 170.0) * 0.4);
  float r = uCare3.x * cheeksZone * blotch * (1.0 - uCare4.y * 0.6);
  vec3 redTint = mix(vec3(1.2, 0.74, 0.74), vec3(0.86, 0.66, 0.68), deep);
  col = mix(col, col * redTint, r * (0.85 + deep * 0.15));
  float bump = step(0.74, dsHash(floor(vMapUv * 900.0))) * r;
  col = mix(col, col * redTint * mix(1.05, 0.9, deep), bump * 0.7);
  dsH += bump * 0.6 + r * 0.08;
}
if (uCare3.y > 0.001) {
  // hyperpigmentation: patches on the cheeks and forehead plus small dark marks, faded by serum
  float patchN = smoothstep(0.52, 0.78, dsNoise(vMapUv * 28.0) * 0.65 + dsNoise(vMapUv * 90.0) * 0.35);
  float dots = step(0.9, dsHash(floor(vMapUv * 260.0))) * smoothstep(0.5, 0.2, length(fract(vMapUv * 260.0) - 0.5));
  float zone = clamp(mD.r * 0.8 + mD.g + mD.b + mE.r * 0.5, 0.0, 1.0);
  float pg = uCare3.y * zone * clamp(patchN * 0.75 + dots, 0.0, 1.0) * (1.0 - uCare4.z * 0.35);
  col = mix(col, col * mix(vec3(0.66, 0.55, 0.48), vec3(0.6, 0.5, 0.46), deep), pg * 0.9);
}
if (uCare3.z > 0.001) {
  // dry, flaky skin: an ashy dullness and lifted white flakes on the forehead, nose sides and chin
  float zone = clamp(mD.r + mD.a * 0.8 + mE.r + cheeksZone * 0.4, 0.0, 1.0);
  float patchN = smoothstep(0.45, 0.7, dsNoise(vMapUv * 40.0) * 0.6 + dsNoise(vMapUv * 120.0) * 0.4);
  float d = uCare3.z * zone * patchN * (1.0 - uCare4.x);
  vec3 ash = mix(vec3(0.84, 0.78, 0.74), vec3(0.62, 0.6, 0.6), deep);
  col = mix(col, max(col, ash * 0.5) * 1.08, d * (0.25 + deep * 0.25));
  float flake = step(0.72, dsNoise(vMapUv * 1300.0)) * step(0.55, dsNoise(vMapUv * 300.0 + 3.1));
  col = mix(col, ash * 1.05, flake * d * 0.8);
  dsH += flake * d * 0.6;
}

/* ---- tattoos: ink sits in the skin, under the makeup; healed ink is a little soft and never pure black ---- */
if (uTattooFx.x > 0.5) {
  vec4 ink = texture2D(uTattoo, vMapUv);
  if (ink.a > 0.002) {
    vec3 inkCol = ink.rgb;
    float a = ink.a * 0.92 * (1.0 - uTattooFx.y);
    // ink reads through the skin tone: multiply plus a little of the ink's own colour
    vec3 inked = col * mix(vec3(1.0), inkCol * 1.6 + 0.08, 0.92);
    // on deep skin, healed ink shows as a cooler blue-black mark (not just "darker"): shift toward
    // it by how deep the tone is, so tattoos read on every skin tone
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float deep = 1.0 - smoothstep(0.02, 0.22, lum);
    // (clearly darker too, ~a third of the skin's brightness: hue alone doesn't read on deep tones)
    inked = mix(inked, col * vec3(0.3, 0.36, 0.52) + vec3(0.0, 0.0006, 0.0028) + inkCol * 0.04, deep * 0.9);
    col = mix(col, inked, a);
    // fresh ink / laser session: a pink, raised halo that fades as it heals
    col = mix(col, col * vec3(1.18, 0.86, 0.86), uTattooFx.z * smoothstep(0.0, 0.4, ink.a));
  }
}

/* ---- who she is: a mole, a birthmark, freckles or vitiligo (under the makeup) ---- */
float mk = uMark.w;
if (mk > 0.5) {
  float md = length((vMapUv - uMark.xy) * vec2(1.0, 1.0));
  if (mk < 1.5) {
    // mole: a small, distinctly dark brown-black dot (it should read at a glance)
    float m = smoothstep(0.0034, 0.0018, md);
    col = mix(col, col * vec3(0.17, 0.12, 0.1) + vec3(0.006, 0.003, 0.002), m);
  } else if (mk < 2.5) {
    // birthmark: a soft irregular patch
    float edge = 0.032 * (0.75 + 0.5 * dsNoise(vMapUv * 120.0));
    float m = smoothstep(edge, edge * 0.55, md);
    col = mix(col, col * vec3(0.72, 0.5, 0.48), m * 0.75);
  } else if (mk < 3.5) {
    // freckles across the nose and cheeks
    vec2 fc = floor(vMapUv * 520.0);
    float frk = step(0.82, dsHash(fc)) * smoothstep(0.5, 0.15, length(fract(vMapUv * 520.0) - 0.5));
    float zone = clamp(mD.g + mD.b + mD.a * 1.2, 0.0, 1.0);
    col = mix(col, col * vec3(0.62, 0.5, 0.42), frk * zone * 0.85);
  } else {
    // vitiligo: lighter patches with soft irregular edges
    float n = dsNoise(vMapUv * 18.0) * 0.65 + dsNoise(vMapUv * 55.0) * 0.35;
    float m = smoothstep(0.58, 0.66, n) * faceM;
    col = mix(col, vec3(0.93, 0.8, 0.72) * (0.75 + 0.25 * dl), m);
  }
}

/* ---- blemishes: raised pimples, popped marks, treated spots, product dabs ---- */
for (int i = 0; i < ${NSPOT}; i++) {
  vec4 sa = uSpotA[i]; vec4 sb = uSpotB[i];
  if (sa.w < 0.5 && sb.x < 0.01) continue;
  float d = length(vMapUv - sa.xy) / max(sa.z, 1e-5);
  if (d > 5.0) continue;
  float halo = exp(-d * d * 1.1);
  float core = exp(-d * d * 7.0);
  vec3 redS = mix(vec3(1.18, 0.72, 0.7), vec3(0.88, 0.62, 0.62), deep);
  float heal = 1.0 - sb.z; // 1 = fresh mark .. 0 = healed away
  if (sa.w > 0.5 && sa.w < 1.5) {
    // pimple: red halo, a pale head that shows more as it is squeezed, raised bump
    float sq = sb.y;
    col = mix(col, col * redS, halo * 0.65);
    col = mix(col, vec3(0.93, 0.86, 0.66) * (0.6 + 0.4 * dl), core * (0.35 + sq * 0.5) * (1.0 - step(0.97, sq)));
    dsH += (halo * 0.7 + core * 0.5) * (1.0 - sq * 0.75);
  } else if (sa.w > 1.5 && sa.w < 2.5) {
    // popped: a small flat red mark that heals away
    col = mix(col, col * redS, halo * 0.5 * heal);
  } else if (sa.w > 2.5 && sa.w < 3.5) {
    // treated: calm, slightly matte, a little lighter
    col = mix(col, col * vec3(1.06, 0.95, 0.93), halo * 0.3 * heal);
  } else if (sa.w > 3.5 && sa.w < 4.5) {
    // flat: what a patch leaves, a flat, faintly pink spot
    col = mix(col, col * mix(vec3(1.08, 0.88, 0.88), vec3(0.95, 0.85, 0.85), deep), halo * 0.35 * heal);
  } else if (sa.w > 4.5 && sa.w < 5.5) {
    // boil: a large, deep, tender lump: wide hot redness, a raised dome and a yellow head
    float wide = exp(-d * d * 0.35);
    col = mix(col, col * redS * vec3(1.02, 0.95, 0.95), wide * 0.75);
    col = mix(col, vec3(0.96, 0.84, 0.5) * (0.55 + 0.45 * dl), core * 0.75);
    dsH += wide * 1.4 + core * 0.6;
  } else if (sa.w > 5.5) {
    // drained: red, flat and healing
    float wide = exp(-d * d * 0.4);
    col = mix(col, col * redS, wide * 0.45 * heal);
  }
  // spot treatment product sitting on it, absorbing as the dab goes to 0
  col = mix(col, vec3(0.94, 0.93, 0.9), core * sb.x * 0.85);
  dsH += core * sb.x * 0.25;
}

/* ---- base makeup ---- */
col = mix(col, uCorrector.rgb * mix(vec3(1.0), dtl, 0.5), mB.b * uCorrector.a * 0.6);
col = mix(col, uFoundation.rgb * mix(vec3(1.0), dtl, 0.55), faceM * uFoundation.a * 0.8);
col = mix(col, uConcealer.rgb * mix(vec3(1.0), dtl, 0.5), mB.b * uConcealer.a * 0.85);
col = mix(col, uPowder.rgb * mix(vec3(1.0), dtl, 0.6), faceM * uPowder.a * 0.18);
// sculpt: contour, bronzer and blush multiply into the skin (they hold tint factors)
col = mix(col, col * uContour.rgb, mB.r * uContour.a);
col = mix(col, col * uBronzer.rgb, clamp(mE.g + mB.r * 0.5 + mD.r * 0.25, 0.0, 1.0) * uBronzer.a * 0.7);
col = mix(col, col * uBlush.rgb, mA.a * uBlush.a * 0.8);
col = mix(col, uBlush.rgb * dl * 0.18, mA.a * uBlush.a * 0.12);
col += (vec3(1.0) - col) * uHighlight.rgb * mB.g * uHighlight.a * 0.32;
// close-cropped hair painted on the scalp (hairline / density procedures push it further)
col = mix(col, uScalp.rgb * (0.55 + 0.45 * dl), clamp(mC.b * (1.5 + uCare2.w * 2.0), 0.0, 1.0) * uScalp.a);
// brows, eyes
col = mix(col, uBrow.rgb, mB.a * uBrow.a * 0.7);
col = mix(col, uShadow.rgb * mix(1.0, dl, 0.35), mA.b * uShadow.a * 0.92);
col += (uInner.rgb - col) * mE.b * uInner.a * 0.7;
float dsLiner = smoothstep(0.12, 0.55, mA.g);
col = mix(col, uLiner.rgb, dsLiner * uLiner.a);
col = mix(col, uLowerLiner.rgb, smoothstep(0.2, 0.6, mC.a) * uLowerLiner.a * 0.85);
// lips: colour, an ombre centre, liner on the edge, frost
col = mix(col, uLip.rgb * (0.7 + 0.3 * clamp(dl, 0.0, 1.4)), dsLip * uLip.a);
vec2 lc = (vMapUv - uLipCentreUv.xy) / max(uLipCentreUv.zw, vec2(1e-5));
float ombre = dsLip * exp(-dot(lc, lc) * 1.6);
col = mix(col, uLipCentre.rgb * (0.7 + 0.3 * clamp(dl, 0.0, 1.4)), ombre * uLipCentre.a);
col = mix(col, uLipLiner.rgb, smoothstep(0.12, 0.6, mC.g) * uLipLiner.a * 0.9);
col = mix(col, col + vec3(0.16, 0.16, 0.2), dsLip * uLipFx.y * 0.6);
col = mix(col, uNails.rgb, nailM * uNails.a);

/* ---- skincare products on the skin right now ---- */
float foam = dot(mD, uFoamD) + mE.r * uFoamE.x + mE.g * uFoamE.y;
float wet = dot(mD, uWetD) + mE.r * uWetE.x + mE.g * uWetE.y;
float cream = dot(mD, uCreamD) + mE.r * uCreamE.x + mE.g * uCreamE.y;
float sheen = dot(mD, uSheenD) + mE.r * uSheenE.x + mE.g * uSheenE.y;
foam = clamp(foam, 0.0, 1.0); wet = clamp(wet, 0.0, 1.0); cream = clamp(cream, 0.0, 1.0); sheen = clamp(sheen, 0.0, 1.0);
col *= 1.0 - wet * 0.1;
// foam: soft lather clumps with tiny bubble glints (no tiling pattern)
float lather = dsNoise(vMapUv * 90.0) * 0.6 + dsNoise(vMapUv * 260.0) * 0.4;
float bubble = step(0.86, dsNoise(vMapUv * 900.0));
col = mix(col, vec3(0.95, 0.95, 0.97) + bubble * 0.05, foam * smoothstep(0.3, 0.55, lather + foam * 0.25) * 0.92);
// unblended cream: soft dollops that thin out as it's rubbed in
float dollop = smoothstep(0.42, 0.62, dsNoise(vMapUv * 45.0) * 0.7 + dsNoise(vMapUv * 130.0) * 0.3);
float streak = dollop;
col = mix(col, vec3(0.95, 0.94, 0.92), cream * (0.25 + 0.75 * dollop) * 0.8);
col = mix(col, vec3(0.92, 0.9, 0.88), mB.b * uCare2.x * 0.55);
col = mix(col, col * 0.98 + 0.04, faceM * uCare2.z * 0.35);
dsH += foam * lather * 0.35 + cream * streak * 0.2;
// just washed: beads of water all over the face (dew), each a tiny raised lens
float dsDrop = 0.0;
if (uCare3.w > 0.001) {
  vec2 g = vMapUv * 210.0;
  vec2 cell = floor(g);
  float hh = dsHash(cell);
  vec2 c0 = vec2(dsHash(cell + 3.7), dsHash(cell + 9.1)) * 0.6 + 0.2;
  float rr = 0.12 + 0.28 * dsHash(cell + 5.3);
  float dd = length(fract(g) - c0) / rr;
  float on = step(1.0 - uCare3.w * 0.55, hh) * faceM;
  dsDrop = on * smoothstep(1.0, 0.7, dd);
  col *= 1.0 - dsDrop * 0.12;
  dsH += on * max(0.0, 1.0 - dd * dd) * 0.9;
}
diffuseColor.rgb = col;
`

const FRAG_ROUGHNESS = /* glsl */ `
roughnessFactor = 0.6 - uGlow * 0.2 - uCare.z * 0.08;
roughnessFactor = mix(roughnessFactor, uBase.x, faceM * uBase.w);
roughnessFactor = mix(roughnessFactor, 0.78, faceM * uBase.y);
roughnessFactor = mix(roughnessFactor, 0.42, faceM * uBase.z * 0.6);
float lipRough = mix(mix(0.45, 0.62, uLipFx.z), 0.06, uLipFx.x);
lipRough = mix(lipRough, 0.2, uLipFx.y);
roughnessFactor = mix(roughnessFactor, mix(lipRough, 0.08, uCare2.y), dsLip);
roughnessFactor = mix(roughnessFactor, 0.3, mB.g * uHighlight.a);
roughnessFactor = mix(roughnessFactor, 0.3, mA.b * uShadow.a * uShimmer);
roughnessFactor = mix(roughnessFactor, 0.12, nailM * uNails.a);
roughnessFactor = mix(roughnessFactor, 0.22, sheen);
roughnessFactor = mix(roughnessFactor, 0.12, wet);
roughnessFactor = mix(roughnessFactor, 0.2, uCare3.w * faceM * 0.7);
roughnessFactor = mix(roughnessFactor, 0.03, dsDrop);
roughnessFactor = mix(roughnessFactor, 0.34, uCare4.w * faceM);
roughnessFactor = mix(roughnessFactor, 0.75, foam);
roughnessFactor = mix(roughnessFactor, 0.55, cream);
`

const FRAG_NORMAL = /* glsl */ `
if (dsH > 0.0005) normal = dsPerturb(-vViewPosition, normal, vec2(dFdx(dsH), dFdy(dsH)) * 1.4, faceDirection);
`

const FRAG_SPARKLE = /* glsl */ `
float dsSp = step(0.993, dsHash(floor(vMapUv * 1600.0)));
totalEmissiveRadiance += (uShadow.rgb + 0.35) * dsSp * mA.b * uShadow.a * uShimmer * 0.45;
totalEmissiveRadiance += uHighlight.rgb * dsSp * mB.g * uHighlight.a * 0.18;
totalEmissiveRadiance += uInner.rgb * dsSp * mE.b * uInner.a * 0.25;
totalEmissiveRadiance += vec3(0.9, 0.92, 1.0) * dsSp * dsLip * uLipFx.y * 0.35;
// after sunscreen: a soft, luminous lit-from-within glow on the high points
totalEmissiveRadiance += uTone * (mB.g * 0.9 + faceM * 0.25) * uCare4.w * 0.12;
`

const v4 = () => new Vector4(0, 0, 0, 0)

export function createSkinMaterial(src: MeshStandardMaterial, masks: SkinMasks, faceRect: [number, number, number, number]) {
  const [u0, v0, u1, v1] = faceRect
  const uniforms = {
    uTone: { value: new Color() },
    // glTF flips V: Blender v becomes 1 - v.
    uFaceRect: { value: new Vector4(u0, 1 - v1, u1, 1 - v0) },
    uLipFx: { value: v4() },
    uShimmer: { value: 0 },
    uGlow: { value: 0.3 },
    uBase: { value: v4() },
    uCare: { value: v4() },
    uCare2: { value: v4() },
    uCare3: { value: v4() },
    uCare4: { value: v4() },
    uLipCentreUv: { value: new Vector4(0, 0, 0.01, 0.005) },
    uMark: { value: new Vector4() },
    uSpotA: { value: Array.from({ length: NSPOT }, v4) },
    uSpotB: { value: Array.from({ length: NSPOT }, v4) },
    uMaskA: { value: masks.faceA },
    uMaskB: { value: masks.faceB },
    uMaskC: { value: masks.faceC },
    uMaskD: { value: masks.faceD },
    uMaskE: { value: masks.faceE },
    uRegionsOn: { value: masks.faceD && masks.faceE ? 1 : 0 },
    uBodyMask: { value: masks.body },
    uHide: { value: null },
    uHideOn: { value: v4() },
    uTattoo: { value: null },
    uTattooFx: { value: v4() },
    ...Object.fromEntries(LAYERS.map((l) => [`u${l}`, { value: v4() }])),
    ...Object.fromEntries(FX.flatMap((f) => [[`u${f}D`, { value: v4() }], [`u${f}E`, { value: v4() }]])),
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
  const baseNormal = mat.normalScale.clone()
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG_LAYERS}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGHNESS}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${FRAG_NORMAL}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${FRAG_SPARKLE}`)
  }
  mat.customProgramCacheKey = () => 'dollscene-skin-v4'
  return { material: mat, uniforms, baseNormal }
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

const FINISH_ROUGH = { matte: 0.78, satin: 0.55, dewy: 0.36 } as const
const BROW_FILL = { natural: 0.3, pencil: 0.6, pomade: 0.85, laminated: 0.45 } as const
const SPOT_CODE = { pimple: 1, popped: 2, treated: 3, flat: 4, boil: 5, drained: 6 } as const

/** Where the lips sit in UV, from the build's landmarks (for the ombre centre). */
export function lipCentre(care: CareData | undefined, out: Vector4) {
  const c = care?.landmarks.lips
  const l = care?.landmarks.lipCornerL
  const r = care?.landmarks.lipCornerR
  if (!c || !l || !r) return out.set(0, 0, 0.01, 0.005)
  const half = new Vector2(...l.uv).distanceTo(new Vector2(...r.uv)) / 2
  return out.set(c.uv[0], c.uv[1], half * 0.7, half * 0.38)
}

/**
 * The saved look plus what is happening this frame. `reveal` (0..1 per makeup key) fades a layer
 * in while it is being applied; `clinic` previews procedures without saving them.
 */
export function applyLookToSkin(u: SkinUniforms, look: StudioLook, opts: { reveal?: Partial<Record<string, number>>; clinic?: Partial<Record<ClinicId, number>>; fx?: SkinFx; care?: CareData } = {}) {
  const m = look.makeup
  const rv = (k: string) => opts.reveal?.[k] ?? 1
  skinColor(look.skin.tone, look.skin.undertone, u.uTone.value)
  u.uGlow.value = look.skin.glow
  setLayer(u.uCorrector, m.corrector.color, m.corrector.amount * rv('corrector'))
  setLayer(u.uFoundation, m.foundation.color, m.foundation.amount * rv('foundation'))
  setLayer(u.uConcealer, m.concealer.color, m.concealer.amount * rv('concealer'))
  setLayer(u.uPowder, m.powder.color, m.powder.amount * rv('powder'))
  setTint(u.uContour, m.contour.color, m.contour.amount * rv('contour'), 0.55)
  setTint(u.uBronzer, m.bronzer.color, m.bronzer.amount * rv('bronzer'), 0.85)
  setTint(u.uBlush, m.blush.color, m.blush.amount * rv('blush'), 1.0)
  setLayer(u.uHighlight, m.highlight.color, m.highlight.amount * rv('highlight'))
  setLayer(u.uShadow, m.eyeshadow.color, m.eyeshadow.amount * rv('eyeshadow'))
  u.uShimmer.value = m.eyeshadow.shimmer
  setLayer(u.uInner, m.innerCorner.color, m.innerCorner.amount * rv('innerCorner'))
  setLayer(u.uLiner, m.liner.color, m.liner.amount * rv('liner'))
  setLayer(u.uLowerLiner, m.lowerLiner.color, m.lowerLiner.amount * rv('lowerLiner'))
  setLayer(u.uLipLiner, m.lipLiner.color, m.lipLiner.amount * rv('lipLiner'))
  setLayer(u.uLip, m.lipstick.color, m.lipstick.amount * rv('lipstick'))
  setLayer(u.uLipCentre, m.lipCentre.color, m.lipCentre.amount * rv('lipCentre'))
  const gloss = m.lipFinish === 'gloss' ? Math.max(m.gloss, 0.85) : m.gloss
  u.uLipFx.value.set(gloss * (m.lipFinish === 'matte' ? 0.15 : 1), m.lipFinish === 'frost' ? m.lipstick.amount * rv('lipstick') : 0, m.lipFinish === 'matte' ? 1 : 0, m.primer * rv('primer'))
  u.uBase.value.set(FINISH_ROUGH[m.foundationFinish], m.powder.amount * rv('powder') * (1 - m.setting * 0.6), m.setting * rv('setting'), m.foundation.amount * rv('foundation'))
  setLayer(u.uBrow, look.brows.color, BROW_FILL[look.brows.style])
  const clinic = opts.clinic ?? look.clinic
  const hairline = Math.max(clinicEffect(look, 'hairline', clinic), clinicEffect(look, 'density', clinic) * 0.6)
  setLayer(u.uScalp, look.hair.color, look.hair.style === 'none' ? look.hair.crop : 0.35)
  setLayer(u.uNails, look.nails.color, look.nails.toes ? look.nails.amount : 0)

  const c = look.care
  const fill = clinicEffect(look, 'underEyeFill', clinic)
  u.uCare.value.set(c.underEye * (1 - fill * 0.85), c.texture, c.hydration, c.lips)
  const fx = opts.fx
  // the mineral SPF's white cast is gone: sunscreen now reads as a luminous glow (uCare4.w)
  u.uCare2.value.set(fx?.eyeCream ?? 0, fx?.balm ?? 0, 0, hairline)
  u.uCare3.value.set(c.rash, c.pigment, c.dry, Math.max(c.dew, fx?.dew ?? 0))
  u.uCare4.value.set(fx?.flakesOff ?? 0, fx?.soothe ?? 0, fx?.bright ?? 0, c.spf ? Math.min(1, 0.55 + c.glow * 0.6) : 0)
  if (opts.care) lipCentre(opts.care, u.uLipCentreUv.value)
  const kind = MARKS.indexOf(look.skin.mark)
  const at = opts.care?.landmarks[look.skin.markAt]
  let mu = at?.uv[0] ?? 0
  let mv = at?.uv[1] ?? 0
  // a beauty mark "at the lip corner" sits BESIDE the lip, a little out and up from the corner (on
  // the skin, never in the lip colour), measured from her own mouth so it fits every face
  const lips = opts.care?.landmarks.lips
  const nose = opts.care?.landmarks.noseTip
  if (at && lips && nose && look.skin.markAt.startsWith('lipCorner')) {
    const du = at.uv[0] - lips.uv[0]
    const dv = at.uv[1] - lips.uv[1]
    const half = Math.hypot(du, dv)
    const ul = Math.hypot(nose.uv[0] - lips.uv[0], nose.uv[1] - lips.uv[1]) || 1
    mu += du * 0.35 + ((nose.uv[0] - lips.uv[0]) / ul) * half * 0.6
    mv += dv * 0.35 + ((nose.uv[1] - lips.uv[1]) / ul) * half * 0.6
  }
  u.uMark.value.set(mu, mv, 0, kind > 0 && (at || kind >= 3) ? kind : 0)

  for (const f of FX) {
    const r = fx ? fx[f.toLowerCase() as 'foam' | 'wet' | 'cream' | 'sheen'] : null
    u[`u${f}D`].value.set(r?.forehead ?? 0, r?.cheekL ?? 0, r?.cheekR ?? 0, r?.nose ?? 0)
    u[`u${f}E`].value.set(r?.chin ?? 0, r?.perimeter ?? 0, 0, 0)
  }
  const spots = opts.care?.spots ?? []
  SPOT_IDS.forEach((id, i) => {
    const s = spots.find((x) => x.id === id)
    const st = c.spots[id]
    const a = u.uSpotA.value[i]
    if (!s) return a.set(0, 0, 0, 0)
    a.set(s.uv[0], s.uv[1], s.r, st ? SPOT_CODE[st] : 0)
    u.uSpotB.value[i].set(fx?.dab[id] ?? 0, fx?.squeeze[id] ?? 0, fx?.heal[id] ?? 0, 0)
  })
}

/**
 * Packs up to four hide masks (each a red-channel mask in body UV) into one RGBA texture, channel
 * per slot. A DataTexture: no canvas premultiplication, so the alpha channel is a real fourth mask.
 */
export class HidePack {
  readonly texture: DataTexture
  private readonly data: Uint8Array
  private readonly slots: (Texture | null)[] = [null, null, null, null]
  private readonly size: number
  constructor(size = 1024) {
    this.size = size
    this.data = new Uint8Array(size * size * 4)
    this.texture = new DataTexture(this.data, size, size, RGBAFormat)
    this.texture.colorSpace = NoColorSpace
    this.texture.magFilter = LinearFilter
    this.texture.minFilter = LinearFilter
    this.texture.needsUpdate = true
  }
  set(slot: 0 | 1 | 2 | 3, t: Texture | null) {
    if (this.slots[slot] === t) return
    this.slots[slot] = t
    const S = this.size
    const d = this.data
    for (let i = slot; i < d.length; i += 4) d[i] = 0
    const img = t?.image as CanvasImageSource | undefined
    if (img) {
      const cv = document.createElement('canvas')
      cv.width = cv.height = S
      const g = cv.getContext('2d', { willReadFrequently: true })!
      g.drawImage(img, 0, 0, S, S)
      const src = g.getImageData(0, 0, S, S).data
      for (let i = 0; i < S * S; i++) d[i * 4 + slot] = src[i * 4]
    }
    this.texture.needsUpdate = true
  }
}
