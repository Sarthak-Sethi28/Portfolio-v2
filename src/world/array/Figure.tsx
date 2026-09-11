'use client'

import type { Palette } from '../atmosphere/palette'

/**
 * A person, far out on the plain.
 *
 * The single cheapest thing in this scene and one of the most important. In
 * the reference frame there is a tiny silhouette walking the salt flat, and it
 * is the ONLY object in the image whose real-world size the viewer already
 * knows. Everything else — slabs, ring, dish — has no inherent scale, so
 * without this the array could be two metres tall or two hundred. With it,
 * the eye measures the monoliths against a human and they become enormous.
 *
 * Deliberately not detailed: at this distance it is a few dark pixels, and
 * anything more would read as a character rather than as a unit of measure.
 */
export function Figure({
  palette,
  position = [46, 0, -150],
  height = 1.75,
}: {
  palette: Palette
  position?: [number, number, number]
  /** Metres. World units are metres, so this is a real person's height. */
  height?: number
}) {
  const legs = height * 0.48
  const torso = height * 0.36
  const head = height * 0.1

  return (
    <group position={position}>
      <mesh position={[0, legs / 2, 0]}>
        <capsuleGeometry args={[height * 0.055, legs * 0.7, 3, 6]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, legs + torso / 2, 0]}>
        <capsuleGeometry args={[height * 0.075, torso * 0.6, 3, 6]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, legs + torso + head / 2, 0]}>
        <sphereGeometry args={[head * 0.62, 8, 8]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  )
}
