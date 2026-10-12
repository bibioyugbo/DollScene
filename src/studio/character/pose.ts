import { Quaternion, Vector3, type Bone, type Object3D } from 'three'

/**
 * The MakeHuman rig rests in an A-pose. For a beauty preview the arms hang relaxed:
 * rotate each upper arm (in world space) so it points down and slightly out, and bend
 * the elbows a little. Hair and clothes are bound to these same bones, so they follow.
 */

const v1 = new Vector3()
const v2 = new Vector3()
const q = new Quaternion()
const qp = new Quaternion()
const qb = new Quaternion()

function bone(root: Object3D, name: string): Bone | null {
  return (root.getObjectByName(name) as Bone | undefined) ?? null
}

/** Rotate `b` so the direction from b to `child` becomes `target` (world space). */
function aim(b: Bone, child: Bone, target: Vector3) {
  b.updateWorldMatrix(true, true)
  b.getWorldPosition(v1)
  child.getWorldPosition(v2)
  const dir = v2.sub(v1).normalize()
  q.setFromUnitVectors(dir, target.clone().normalize())
  b.parent!.getWorldQuaternion(qp)
  b.getWorldQuaternion(qb)
  b.quaternion.copy(qp.invert().multiply(q).multiply(qb))
  b.updateWorldMatrix(false, true)
}

export function relaxPose(root: Object3D) {
  root.updateWorldMatrix(true, true)
  for (const side of ['Left', 'Right'] as const) {
    const s = side === 'Left' ? 1 : -1
    const arm = bone(root, `${side}Arm`)
    const fore = bone(root, `${side}ForeArm`)
    const hand = bone(root, `${side}Hand`)
    if (!arm || !fore || !hand) continue
    // glTF space: +Y up, the character faces +Z, her left is +X.
    aim(arm, fore, new Vector3(0.2 * s, -1, -0.02))
    aim(fore, hand, new Vector3(0.1 * s, -1, 0.16))
  }
}

export interface IdleRig {
  bones: { b: Bone; rest: Quaternion }[]
}

export function idleRig(root: Object3D): IdleRig {
  const names = ['Spine1', 'Spine2', 'Neck', 'Head', 'Hips']
  return { bones: names.map((n) => bone(root, n)).filter((b): b is Bone => !!b).map((b) => ({ b, rest: b.quaternion.clone() })) }
}

const qi = new Quaternion()
const axisX = new Vector3(1, 0, 0)
const axisY = new Vector3(0, 1, 0)
const axisZ = new Vector3(0, 0, 1)

/** Breathing, a slow weight shift and a little head drift. */
export function idleTick(rig: IdleRig, t: number, strength: number) {
  for (const { b, rest } of rig.bones) {
    b.quaternion.copy(rest)
    if (!strength) continue
    const breath = Math.sin(t * 1.4) * 0.012 * strength
    if (b.name === 'Spine1' || b.name === 'Spine2') b.quaternion.multiply(qi.setFromAxisAngle(axisX, breath * 0.6))
    if (b.name === 'Hips') b.quaternion.multiply(qi.setFromAxisAngle(axisZ, Math.sin(t * 0.35) * 0.012 * strength))
    if (b.name === 'Head') {
      b.quaternion.multiply(qi.setFromAxisAngle(axisY, Math.sin(t * 0.27) * 0.05 * strength))
      b.quaternion.multiply(qi.setFromAxisAngle(axisX, Math.sin(t * 0.21 + 1) * 0.025 * strength))
    }
  }
}
