import { useLayoutEffect } from 'react'
import { BackSide, Color, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import type { V3 } from '../types'
import { GLSL_NOISE, mutate, useAnim, useBuilt } from './core'

export interface SkyParams {
  top: string
  /** Colour at the horizon. */
  mid: string
  /** Colour below the horizon (rarely visible, keep close to the ground haze). */
  bottom: string
  /** Direction to the sun (normalised internally). */
  sunDir?: V3
  sunColor?: string
  /** Sun disc angular radius in radians (0 hides the disc). */
  sunSize?: number
  /** Strength of the glow around the sun (0..2). */
  sunGlow?: number
  stars?: number
  moonDir?: V3
  /** Moon disc angular radius in radians (0 hides it). */
  moonSize?: number
  moonColor?: string
  /** Cloud coverage 0..1. */
  clouds?: number
  cloudLit?: string
  cloudShade?: string
  /** Horizon band softness (0.2 ~ crisp, 0.8 ~ hazy). */
  haze?: number
}

const vert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`

const frag = /* glsl */ `
uniform vec3 uTop, uMid, uBottom, uSunDir, uSunColor, uMoonDir, uMoonColor, uCloudLit, uCloudShade;
uniform float uSunSize, uSunGlow, uStars, uMoonSize, uCloud, uTime, uHaze;
varying vec3 vDir;
${GLSL_NOISE}
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = h > 0.0 ? mix(uMid, uTop, pow(smoothstep(0.0, 0.75, h), uHaze)) : mix(uMid, uBottom, smoothstep(0.0, -0.18, h));
  // sun glow + disc
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunColor * uSunGlow * (pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.5);
  if (uSunSize > 0.0) c = mix(c, uSunColor * 1.35 + 0.15, smoothstep(cos(uSunSize), cos(uSunSize * 0.82), sd));
  // stars
  if (uStars > 0.0) {
    vec3 p = d * 300.0; vec3 cell = floor(p); vec3 f = fract(p) - 0.5;
    float r = hash13(cell);
    float s = step(0.9935, r) * smoothstep(0.45, 0.0, length(f));
    s *= 0.55 + 0.45 * sin(uTime * (1.0 + r * 3.0) + r * 80.0);
    c += vec3(0.9, 0.93, 1.0) * s * uStars * smoothstep(0.02, 0.3, h) * (0.4 + fract(r * 913.0));
  }
  // moon
  if (uMoonSize > 0.0) {
    float md = max(dot(d, uMoonDir), 0.0);
    float disc = smoothstep(cos(uMoonSize), cos(uMoonSize * 0.94), md);
    vec3 tang = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
    vec2 mp = vec2(dot(d, tang), dot(d, cross(tang, uMoonDir))) / uMoonSize;
    float mott = fbm(mp * 2.4 + 3.0);
    vec3 moon = uMoonColor * (0.78 + 0.32 * smoothstep(0.35, 0.75, mott));
    c += uMoonColor * (pow(md, 900.0) * 0.5 + pow(md, 90.0) * 0.18 + pow(md, 12.0) * 0.05);
    c = mix(c, moon, disc);
  }
  // clouds (planar projection)
  if (uCloud > 0.0 && h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.004, 0.0);
    float n = fbm(uv * 1.3);
    float cov = smoothstep(1.0 - uCloud * 0.75, 1.15 - uCloud * 0.55, n) * smoothstep(0.0, 0.18, h);
    vec3 cc = mix(uCloudShade, uCloudLit, smoothstep(0.3, 0.9, n + pow(sd, 3.0) * 0.4));
    c = mix(c, cc, cov * 0.9);
  }
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`

/** Big inverted sphere with a graded sky, sun/moon discs, stars and clouds (one draw call). */
export function SkyDome({ animate, radius = 52, ...p }: SkyParams & { animate: boolean; radius?: number }) {
  const { mat, geo } = useBuilt(
    (track) => ({
      geo: track(new SphereGeometry(1, 32, 16)),
      mat: track(
        new ShaderMaterial({
          vertexShader: vert,
          fragmentShader: frag,
          side: BackSide,
          depthWrite: false,
          toneMapped: false,
          uniforms: {
            uTop: { value: new Color() },
            uMid: { value: new Color() },
            uBottom: { value: new Color() },
            uSunDir: { value: new Vector3(0, 1, 0) },
            uSunColor: { value: new Color() },
            uSunSize: { value: 0 },
            uSunGlow: { value: 0 },
            uStars: { value: 0 },
            uMoonDir: { value: new Vector3(0, 1, 0) },
            uMoonColor: { value: new Color() },
            uMoonSize: { value: 0 },
            uCloud: { value: 0 },
            uCloudLit: { value: new Color() },
            uCloudShade: { value: new Color() },
            uTime: { value: 0 },
            uHaze: { value: 0.6 },
          },
        }),
      ),
    }),
    [],
  )
  useLayoutEffect(() => mutate(mat.uniforms, (u) => {
    u.uTop.value.set(p.top)
    u.uMid.value.set(p.mid)
    u.uBottom.value.set(p.bottom)
    u.uSunDir.value.set(...(p.sunDir ?? [0, 1, 0])).normalize()
    u.uSunColor.value.set(p.sunColor ?? '#ffffff')
    u.uSunSize.value = p.sunSize ?? 0
    u.uSunGlow.value = p.sunGlow ?? 0
    u.uStars.value = p.stars ?? 0
    u.uMoonDir.value.set(...(p.moonDir ?? [0, 1, 0])).normalize()
    u.uMoonColor.value.set(p.moonColor ?? '#f4f1e6')
    u.uMoonSize.value = p.moonSize ?? 0
    u.uCloud.value = p.clouds ?? 0
    u.uCloudLit.value.set(p.cloudLit ?? '#ffffff')
    u.uCloudShade.value.set(p.cloudShade ?? '#9aa3b5')
    u.uHaze.value = p.haze ?? 0.6
  }))
  useAnim(animate, (t) => mutate(mat, (m) => (m.uniforms.uTime.value = t)))
  return <mesh geometry={geo} material={mat} scale={radius} renderOrder={-10} frustumCulled={false} />
}
