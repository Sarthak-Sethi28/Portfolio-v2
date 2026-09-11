'use client'

import { MeshReflectorMaterial } from '@react-three/drei'
import type { Palette } from '../atmosphere/palette'

/**
 * The salt plain: a centimetre of standing water over a flat bed.
 *
 * This single plane is doing most of the work in the concept frames. Every
 * vertical in the scene is doubled by it, which is what makes the monoliths
 * read as enormous. At the low quality tier the reflector is swapped for a
 * plain rough material — still dark and wet-looking, just not mirrored.
 */
export function Water({
  palette,
  roughness,
  reflectorResolution,
  distort,
}: {
  palette: Palette
  roughness: number
  reflectorResolution: number
  /** Rain ripple amount, 0 when dry. */
  distort: number
}) {
  const reflective = reflectorResolution > 0

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[4000, 4000, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          // Blur grows with distance, which fakes the way a real wet surface
          // loses coherence toward the horizon.
          blur={[160, 38]}
          resolution={reflectorResolution}
          mixBlur={0.35}
          mixStrength={22}
          roughness={roughness}
          depthScale={1.15}
          minDepthThreshold={0.35}
          maxDepthThreshold={1.3}
          color={palette.waterTint}
          metalness={0.78}
          mirror={0.96}
          distortion={distort}
          reflectorOffset={0.02}
        />
      ) : (
        <meshStandardMaterial
          color={palette.waterTint}
          roughness={Math.max(roughness, 0.35)}
          metalness={0.5}
        />
      )}
    </mesh>
  )
}
