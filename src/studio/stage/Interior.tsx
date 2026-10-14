import { useMemo } from 'react'
import { RepeatWrapping } from 'three'
import { DOOR_BY_ID, ROOMS, type RoomId } from '../rooms'
import { interiorTexture, Planter, signTexture, useFontsTick, wallTexture } from './Hub'

/**
 * Inside a store: its own room behind the doll, in the same look as its building on the street
 * (the brick and red neon of Tolaptsd, Mon Cherie's blush velvet, Dope by Fabby's black marble and
 * gold...): a back wall with the store's racks, shelves or mirrors, its sign, a floor in its
 * material, pendant lights and a rack or plant either side. Kept behind and beside her, never in
 * front, so every framing still shows her clearly.
 */

const FLOOR: Record<string, string> = {
  brick: '#2a2426',
  boutique: '#c9a46a',
  velvet: '#6a2a42',
  gym: '#22324a',
  salon: '#7a3e52',
  gold: '#14110c',
  heritage: '#6b2e1a',
  spa: '#cfe3dc',
  clinic: '#e9e6f2',
  thrift: '#7a5a3a',
  glass: '#2a0a18',
  cinema: '#3a0c10',
}

function Rack({ x, colors }: { x: number; colors: string[] }) {
  return (
    <group position={[x, 0, -1.9]} rotation={[0, x > 0 ? -0.5 : 0.5, 0]}>
      {[-0.55, 0.55].map((dx) => (
        <mesh key={dx} position={[dx, 0.75, 0]}>
          <cylinderGeometry args={[0.018, 0.018, 1.5, 8]} />
          <meshStandardMaterial color="#c0c0c8" metalness={0.8} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.016, 0.016, 1.2, 8]} />
        <meshStandardMaterial color="#c0c0c8" metalness={0.8} roughness={0.25} />
      </mesh>
      {Array.from({ length: 9 }, (_, k) => (
        <mesh key={k} position={[-0.48 + k * 0.12, 1.1, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.36, 0.72, 0.03]} />
          <meshStandardMaterial color={colors[k % colors.length]} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

export function Interior({ room }: { room: RoomId }) {
  const fonts = useFontsTick()
  const d = DOOR_BY_ID[ROOMS[room].door]
  const back = useMemo(() => interiorTexture(d, 2), [d])
  const sign = useMemo(() => signTexture(d, fonts), [d, fonts])
  const wall = useMemo(() => {
    const t = wallTexture(d.facade, d.door).clone()
    t.wrapS = t.wrapT = RepeatWrapping
    t.repeat.set(4, 2)
    t.needsUpdate = true
    return t
  }, [d])
  const clothes = d.facade !== 'spa' && d.facade !== 'clinic' && d.facade !== 'salon' && d.facade !== 'cinema'
  const palette = [d.frame, d.glow, d.door, '#ffffff', '#141414']
  return (
    <group>
      {/* the store's back wall: its racks, shelves or mirrors, lit */}
      <mesh position={[0, 1.7, -3.4]}>
        <planeGeometry args={[8.4, 4.2]} />
        <meshBasicMaterial map={back} toneMapped={false} color="#d8d8d8" />
      </mesh>
      {/* side walls in the building's finish */}
      {[-4.2, 4.2].map((x) => (
        <mesh key={x} position={[x, 1.7, -1.4]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
          <planeGeometry args={[4, 4.2]} />
          <meshStandardMaterial map={wall} roughness={0.85} />
        </mesh>
      ))}
      {/* its sign over the back wall */}
      <mesh position={[0, 3.45, -3.35]}>
        <planeGeometry args={[3.2, 0.8]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, -1]}>
        <planeGeometry args={[8.4, 6]} />
        <meshStandardMaterial color={FLOOR[d.facade]} roughness={d.facade === 'gold' || d.facade === 'clinic' ? 0.18 : 0.6} metalness={d.facade === 'gold' ? 0.3 : 0} />
      </mesh>
      {/* pendant lights */}
      {[-1.6, 0, 1.6].map((x) => (
        <group key={x} position={[x, 3.2, -1.6]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.8, 4]} />
            <meshStandardMaterial color="#222" />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.13, 16, 12]} />
            <meshBasicMaterial color={d.glow} toneMapped={false} />
          </mesh>
          <pointLight color={d.glow} intensity={0.8} distance={4} decay={2} />
        </group>
      ))}
      {clothes ? (
        <>
          <Rack x={-2.3} colors={palette} />
          <Rack x={2.3} colors={[...palette].reverse()} />
        </>
      ) : (
        <>
          <Planter x={-3.2} z={-2.8} tall />
          <Planter x={3.2} z={-2.8} tall />
        </>
      )}
    </group>
  )
}
