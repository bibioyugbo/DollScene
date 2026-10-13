import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Matrix4, Quaternion, ShaderMaterial, Vector3 } from 'three'
import type { V3 } from '../types'

const vert = /* glsl */ `
varying float vAxial; varying vec3 vN; varying vec3 vV; varying vec3 vCol;
void main(){
  vAxial = -position.y;
  vec4 p = vec4(position, 1.0);
  mat4 m = modelMatrix;
  vCol = vec3(1.0);
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vCol = instanceColor;
  #endif
  vec4 w = m * p;
  vN = normalize(mat3(m) * normal);
  vV = normalize(cameraPosition - w.xyz);
  gl_Position = projectionMatrix * viewMatrix * w;
}`

const frag = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity, uFalloff, uSoft;
varying float vAxial; varying vec3 vN; varying vec3 vV; varying vec3 vCol;
void main(){
  float edge = pow(abs(dot(normalize(vN), normalize(vV))), uSoft);
  float a = uOpacity * pow(max(1.0 - vAxial, 0.0), uFalloff) * smoothstep(0.0, 0.04, vAxial) * edge;
  gl_FragColor = vec4(uColor * vCol, a);
  #include <colorspace_fragment>
}`

export function beamMaterial(color: string, opacity: number, falloff = 1.2, soft = 1.6) {
  return new ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: AdditiveBlending,
    toneMapped: false,
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: opacity }, uFalloff: { value: falloff }, uSoft: { value: soft } },
  })
}

/** Unit cone, apex at the origin, opening towards -Y (length 1, end radius 1). */
export function beamGeometry(segs = 18) {
  return new ConeGeometry(1, 1, segs, 1, true).translate(0, -0.5, 0)
}

const _a = new Vector3()
const _d = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const DOWN = new Vector3(0, -1, 0)
/** Matrix for a beam from `from` to `to` with the given end radius. */
export function beamMatrix(from: V3, to: V3, radius: number, out = new Matrix4()) {
  _a.set(...from)
  _d.set(to[0] - from[0], to[1] - from[1], to[2] - from[2])
  const len = _d.length()
  _q.setFromUnitVectors(DOWN, _d.normalize())
  _s.set(radius, len, radius)
  return out.compose(_a, _q, _s)
}
