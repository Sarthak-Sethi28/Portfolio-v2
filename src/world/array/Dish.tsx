'use client'

import { useMemo } from 'react'
import { DoubleSide } from 'three'
import { dishProfile, rimLights, strutRing } from '../geometry/dish'
import type { Palette } from '../atmosphere/palette'

/**
 * The radio telescope.
 *
 * The one object in the array that is not a box, and the only one that is pale
 * rather than black — which is what makes it the eye's destination on the
 * horizon. It is also the contact form (spec §5a), so it is built as an
 * articulated rig: `tilt` and `heading` are driven from outside rather than
 * baked into the geometry.
 */
export function Dish({
  palette,
  position = [150, 0, -230],
  radius = 26,
  tilt = -0.62,
  heading = 2.3,
  /** 0 to 1. Lights the struts and rim during a transmission. */
  transmit = 0,
}: {
  palette: Palette
  position?: [number, number, number]
  radius?: number
  /** Radians from vertical. Negative tips the face skyward. */
  tilt?: number
  heading?: number
  transmit?: number
}) {
  const profile = useMemo(() => dishProfile(radius), [radius])
  const struts = useMemo(() => strutRing(14, radius * 0.66), [radius])
  const lights = useMemo(() => rimLights(12, radius * 0.99, 0), [radius])

  const pedestalHeight = radius * 0.86
  const mountHeight = radius * 0.52

  return (
    <group position={position} rotation={[0, heading, 0]}>
      {/* Pedestal rising out of the water. */}
      <mesh position={[0, pedestalHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[radius * 0.2, radius * 0.3, pedestalHeight, 16]} />
        <meshStandardMaterial color={palette.ambient} roughness={0.85} metalness={0.12} />
      </mesh>

      {/* Yoke that carries the elevation axis. */}
      <mesh position={[0, pedestalHeight + mountHeight / 2, 0]} castShadow>
        <boxGeometry args={[radius * 0.5, mountHeight, radius * 0.34]} />
        <meshStandardMaterial color={palette.ambient} roughness={0.8} metalness={0.18} />
      </mesh>

      {/* Everything above the elevation axis tilts together. */}
      <group position={[0, pedestalHeight + mountHeight, 0]} rotation={[tilt, 0, 0]}>
        {/* The reflector. Rotated so the lathe's +Y becomes the face normal. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <latheGeometry args={[profile, 64]} />
          <meshStandardMaterial
            color="#c8ccc9"
            roughness={0.52}
            metalness={0.3}
            side={DoubleSide}
          />
        </mesh>

        {/* Back lattice. Thin bars from the rim down to the hub — in the
            reference frame these catch the transmission pulse. */}
        {struts.map((s, i) => (
          <mesh
            key={i}
            position={[s.x * 0.5, -radius * 0.26, s.z * 0.5]}
            rotation={[0, -s.angle, Math.PI / 2 - 0.42]}
            castShadow
          >
            <cylinderGeometry args={[0.22, 0.22, radius * 0.92, 6]} />
            <meshStandardMaterial
              color="#3f4446"
              roughness={0.7}
              metalness={0.35}
              emissive="#8fc8ff"
              emissiveIntensity={transmit * 2.2}
            />
          </mesh>
        ))}

        {/* Feed tripod and the receiver at the focus. */}
        {[0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[
                (Math.cos(a) * radius * 0.62) / 2,
                radius * 0.42,
                (Math.sin(a) * radius * 0.62) / 2,
              ]}
              rotation={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]}
            >
              <cylinderGeometry args={[0.16, 0.16, radius * 0.95, 6]} />
              <meshStandardMaterial color="#babfbd" roughness={0.6} metalness={0.3} />
            </mesh>
          )
        })}
        <mesh position={[0, radius * 0.86, 0]}>
          <cylinderGeometry args={[radius * 0.07, radius * 0.05, radius * 0.2, 12]} />
          <meshStandardMaterial color="#d5d9d6" roughness={0.5} metalness={0.4} />
        </mesh>

        {/* Red aircraft warning lights around the rim. Always faintly on;
            §5a blinks them as the morse channel. */}
        {lights.map((l) => (
          <mesh key={l.index} position={l.position}>
            <sphereGeometry args={[0.42, 8, 8]} />
            <meshBasicMaterial color="#ff2d20" toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
