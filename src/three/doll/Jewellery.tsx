import { useMemo } from 'react'
import { CatmullRomCurve3, TubeGeometry, Vector3 } from 'three'
import type { Piercing } from '../../shared/types'
import { GemMat, MetalMat } from './materials'

/**
 * One piece of piercing jewellery at the origin, facing +z.
 * `plane` decides how rings hang: 'ear' rings sit in the ear plane, 'face' rings face forward.
 */
export function Jewellery({ p, plane, to }: { p: Piercing; plane: 'ear' | 'face'; to?: [number, number, number] }) {
  const s = 0.6 + p.size * 0.9
  const gem = p.gem !== 'none' ? p.gem : null
  const ringR = 0.011 * s
  const ringRot: [number, number, number] = plane === 'ear' ? [0, Math.PI / 2, 0] : [0, 0, 0]

  const chain = useMemo(() => {
    if (p.jewellery !== 'chain' || !to) return null
    const a = new Vector3(0, 0, 0)
    const b = new Vector3(...to)
    const mid = a.clone().lerp(b, 0.5).add(new Vector3(0.006, -0.03, 0))
    return new TubeGeometry(new CatmullRomCurve3([a, mid, b]), 24, 0.0012, 4, false)
  }, [p.jewellery, to])

  switch (p.jewellery) {
    case 'stud':
      return (
        <group>
          <mesh position={[0, 0, 0.002]}>
            <sphereGeometry args={[0.0045 * s, 12, 10]} />
            {gem ? <GemMat gem={gem} /> : <MetalMat metal={p.metal} />}
          </mesh>
          {gem && (
            <mesh position={[0, 0, -0.001]}>
              <cylinderGeometry args={[0.005 * s, 0.005 * s, 0.002, 12]} />
              <MetalMat metal={p.metal} />
            </mesh>
          )}
        </group>
      )
    case 'hoop':
    case 'ring':
      return (
        <group rotation={ringRot}>
          <mesh position={[0, -(p.jewellery === 'hoop' ? ringR * 1.4 : ringR * 0.8), 0]}>
            <torusGeometry args={[p.jewellery === 'hoop' ? ringR * 1.4 : ringR * 0.8, 0.0014 * s, 8, 32]} />
            <MetalMat metal={p.metal} />
          </mesh>
          {gem && (
            <mesh position={[0, -(p.jewellery === 'hoop' ? ringR * 2.8 : ringR * 1.6), 0]}>
              <sphereGeometry args={[0.003 * s, 10, 8]} />
              <GemMat gem={gem} />
            </mesh>
          )}
        </group>
      )
    case 'barbell': {
      const len = to ? new Vector3(...to).length() : 0.012 * s
      const dir = to ? new Vector3(...to).normalize() : new Vector3(0, 0, 1)
      const mid = dir.clone().multiplyScalar(len / 2)
      const quat = new Vector3(0, 1, 0)
      return (
        <group>
          <mesh position={mid.toArray()} quaternion={undefined} onUpdate={(m) => m.quaternion.setFromUnitVectors(quat, dir)}>
            <cylinderGeometry args={[0.0011 * s, 0.0011 * s, len, 6]} />
            <MetalMat metal={p.metal} />
          </mesh>
          {[0, 1].map((k) => (
            <mesh key={k} position={dir.clone().multiplyScalar(k * len).toArray()}>
              <sphereGeometry args={[0.0032 * s, 10, 8]} />
              {gem && k === 0 ? <GemMat gem={gem} /> : <MetalMat metal={p.metal} />}
            </mesh>
          ))}
        </group>
      )
    }
    case 'chain':
      return (
        <group>
          <mesh>
            <sphereGeometry args={[0.0035 * s, 10, 8]} />
            <MetalMat metal={p.metal} />
          </mesh>
          {chain && (
            <mesh geometry={chain}>
              <MetalMat metal={p.metal} />
            </mesh>
          )}
        </group>
      )
    case 'cuff':
      return (
        <group rotation={ringRot}>
          <mesh rotation={[0, 0, Math.PI * 0.2]}>
            <torusGeometry args={[ringR * 1.3, 0.0022 * s, 8, 24, Math.PI * 1.4]} />
            <MetalMat metal={p.metal} />
          </mesh>
        </group>
      )
  }
}
