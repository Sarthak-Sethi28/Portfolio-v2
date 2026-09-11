'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import type { Palette } from '../atmosphere/palette'

/**
 * The ring at the centre of the array — the threshold to World 2.
 *
 * A torus with a squared cross-section rather than a round one, so it reads as
 * engineered rather than decorative. The inner face carries a faint emissive
 * so there is always something to walk toward.
 */
export function Aperture({
  palette,
  radius = 16,
  charge = 0,
}: {
  palette: Palette
  radius?: number
  /** 0 to 1 while the visitor holds to enter. */
  charge?: number
}) {
  const glow = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!glow.current) return
    const t = clock.elapsedTime
    // A slow breath, quickening as the hold charges.
    const pulse = 0.5 + 0.5 * Math.sin(t * (0.55 + charge * 6))
    const mat = glow.current.material as { opacity: number }
    mat.opacity = 0.05 + pulse * 0.05 + charge * 0.55
  })

  return (
    <group position={[0, radius + 1.2, -26]}>
      {/* The ring itself. radialSegments of 4 gives flat faces. */}
      <mesh castShadow rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[radius, 1.85, 4, 96]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.42} metalness={0.55} />
      </mesh>

      {/* Membrane across the opening. */}
      <mesh ref={glow}>
        <circleGeometry args={[radius - 1.4, 64]} />
        <meshBasicMaterial
          color={palette.sunColor}
          transparent
          opacity={0.08}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Footings into the water. */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * radius * 0.72, -radius * 0.82, 0]} rotation={[0, 0, s * 0.4]}>
          <boxGeometry args={[3, radius * 0.6, 3]} />
          <meshStandardMaterial color={palette.monolith} roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
    </group>
  )
}
