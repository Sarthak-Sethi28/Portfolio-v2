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
      {/* 4000 units reaches well past the fog's extinction distance; larger
          only costs reflector fill rate for pixels fog has already erased. */}
      <planeGeometry args={[2400, 2400, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          // Just enough to read as a centimetre of water rather than glass.
          //
          // This was [160,38] and then [90,22], and at those values the
          // reflection was smeared into flat darkness — the lower third of the
          // frame looked like a void and the whole mirrored-plain effect, which
          // is half the composition, was simply absent. Blur is also billed per
          // texel over two passes, so the large values were expensive AND
          // destructive.
          blur={[26, 7]}
          resolution={reflectorResolution}
          mixBlur={0.22}
          mixStrength={6}
          roughness={roughness}
          // depthScale fades the reflection by distance from the surface.
          // Enabled, it was erasing almost everything the plain should be
          // mirroring — which is why the lower third of the frame read as a
          // black void rather than as standing water.
          depthScale={0}
          color={palette.waterTint}
          metalness={0.45}
          mirror={1}
          distortion={distort}
          reflectorOffset={0}
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
