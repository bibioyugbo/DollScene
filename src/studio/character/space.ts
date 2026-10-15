import { Matrix4, Quaternion, Vector3, type Bone, type Object3D, type SkinnedMesh } from 'three'

/**
 * Coordinate helpers for attaching things to bones.
 *
 * The shipped GLBs are meshopt-quantised: vertex positions are stored normalised and the
 * dequantisation is folded into each skinned mesh's inverse bind matrices. So a skeleton's
 * boneInverses map *that mesh's quantised space* to bone space, not model space, and differ per
 * module. Model-space anchors from character.json therefore go through the live skinned surface
 * (bound landmark vertices) or the bones' current world matrices, never through boneInverses alone.
 */

const m = new Matrix4()

/** A world-space frame (position + basis) expressed in `bone`'s local space, ready to parent. */
export function toBoneLocal(bone: Bone, pos: Vector3, x: Vector3, y: Vector3, z: Vector3, out: Object3D) {
  bone.updateWorldMatrix(true, false)
  m.makeBasis(x, y, z).setPosition(pos)
  m.premultiply(new Matrix4().copy(bone.matrixWorld).invert())
  // keep the scale: it cancels the doll's height scale on the bone, so the piece stays its real
  // size and lands exactly where it was measured
  m.decompose(out.position, out.quaternion, out.scale)
  bone.add(out)
  return out
}

/** Orthonormal basis with `y` exact and `x` as close as possible to the hint. */
export function basis(yHint: Vector3, xHint: Vector3) {
  const y = yHint.clone().normalize()
  const z = new Vector3().crossVectors(xHint, y).normalize()
  const x = new Vector3().crossVectors(y, z).normalize()
  return { x, y, z }
}

/** A point in `mesh`'s own geometry (bind) space for a point given in `bone`'s local space. */
export function boneLocalToMeshSpace(mesh: SkinnedMesh, bone: Bone, local: Vector3) {
  const i = mesh.skeleton.bones.indexOf(bone)
  if (i < 0) return null
  return local.clone().applyMatrix4(new Matrix4().copy(mesh.skeleton.boneInverses[i]).invert())
}

/** World direction of a model-space axis (the character's own up / forward / left). */
export function modelAxis(root: Object3D, axis: Vector3) {
  return axis.clone().applyQuaternion(root.getWorldQuaternion(new Quaternion())).normalize()
}

/**
 * Bring the whole doll's matrices up to date, including each skinned mesh's bindMatrixInverse
 * (only SkinnedMesh.updateMatrixWorld refreshes it; updateWorldMatrix does not). Call before
 * reading skinned vertex positions right after her height or shape changed.
 */
export function refreshMatrices(root: Object3D) {
  root.updateWorldMatrix(true, false)
  root.updateMatrixWorld(true)
}

/** World centres of the two eyeballs (her left = +X in model space), from the live eye mesh. */
export function eyeCentres(root: Object3D): { L: Vector3; R: Vector3; radius: number } | null {
  const eyes = root.getObjectByName('Eyes') as SkinnedMesh | undefined
  if (!eyes?.isMesh) return null
  refreshMatrices(root)
  const toModel = new Matrix4().copy(root.matrixWorld).invert()
  const v = new Vector3()
  const m = new Vector3()
  const sum = { L: new Vector3(), R: new Vector3() }
  const n = { L: 0, R: 0 }
  const pos = eyes.geometry.attributes.position
  const pts: { side: 'L' | 'R'; p: Vector3 }[] = []
  for (let i = 0; i < pos.count; i++) {
    eyes.getVertexPosition(i, v)
    v.applyMatrix4(eyes.matrixWorld)
    m.copy(v).applyMatrix4(toModel)
    const side = m.x >= 0 ? 'L' : 'R'
    sum[side].add(v)
    n[side]++
    pts.push({ side, p: v.clone() })
  }
  if (!n.L || !n.R) return null
  const L = sum.L.divideScalar(n.L)
  const R = sum.R.divideScalar(n.R)
  let radius = 0
  for (const q of pts) radius = Math.max(radius, q.p.distanceTo(q.side === 'L' ? L : R))
  return { L, R, radius }
}
