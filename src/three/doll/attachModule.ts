import { Bone, Group, Skeleton, type Object3D, type SkinnedMesh } from 'three'

/**
 * Re-bind a module's skinned meshes onto the base skeleton by bone name.
 * Extra bones the base lacks (e.g. Hair_*) are re-parented under their nearest
 * matching ancestor so physics/strand bones keep working.
 */
export function attachModule(base: Object3D, module: Object3D) {
  const bones = new Map<string, Bone>()
  base.traverse((o) => {
    if ((o as Bone).isBone) bones.set(o.name, o as Bone)
  })
  const toAdd: Object3D[] = []
  const extraRoots = new Set<Bone>()
  module.traverse((o) => {
    const sm = o as SkinnedMesh
    if (!sm.isSkinnedMesh) return
    const mapped = sm.skeleton.bones.map((b) => {
      const hit = bones.get(b.name)
      if (hit) return hit
      // Find the topmost unmatched ancestor and graft it onto the base.
      let top: Bone = b
      while (top.parent && (top.parent as Bone).isBone && !bones.has(top.parent.name)) top = top.parent as Bone
      extraRoots.add(top)
      return b
    })
    sm.bind(new Skeleton(mapped, sm.skeleton.boneInverses), sm.bindMatrix)
    toAdd.push(sm)
  })
  for (const root of extraRoots) {
    const anchor = root.parent ? bones.get(root.parent.name) : undefined
    ;(anchor ?? base).add(root)
  }
  if (toAdd.length) {
    const g = new Group()
    g.name = `module:${module.name}`
    toAdd.forEach((m) => g.add(m))
    base.add(g)
    return g
  }
  // Rigid module: a root child named "@BoneName" says where to attach.
  const anchor = module.children.find((c) => c.name.startsWith('@'))
  const bone = anchor ? bones.get(anchor.name.slice(1)) : bones.get('Head')
  const clone = module.clone()
  ;(bone ?? base).add(clone)
  return clone
}

