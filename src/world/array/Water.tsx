'use client'

import { useMemo } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector2 } from 'three'
import type { Palette } from '../atmosphere/palette'
import { waterNormals } from '../materials/ripples'

/**
 * The salt plain: a centimetre of standing water over a flat bed.
 *
 * This single plane does most of the work — every vertical in the scene is
 * doubled by it, which is what makes the piers read as enormous.
 *
 * It has to MOVE. A still mirror reads as polished stone, and the sky above it
 * drifts, so a frozen surface underneath breaks the illusion immediately. Two
 * normal fields at different scales drift in different directions; the
 * interference between them never repeats, which is the difference between
 * water and a scrolling texture. The normals also let the surface GLINT —
 * catching light on the near face of each wave — which a pure reflection
 * distortion can never do.
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
  /** Rain amount. Low but never zero — still water still moves. */
  distort: number
}) {
  const reflective = reflectorResolution > 0
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())

  const coarse = useMemo(() => waterNormals(9, maxAniso), [maxAniso])
  const fine = useMemo(() => waterNormals(26, maxAniso), [maxAniso])
    // Low. An animated normal map on a near-mirror surface changes the specular
  // response every frame, and at high amplitude that sparkles — a genuine
  // per-frame change, unlike the camera shimmer.
  const normalScale = useMemo(() => new Vector2(0.14, 0.14), [])

  // The textures are memoised, so the frame loop can close over them directly
  // — no ref, and nothing dereferenced during render.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Crossing drifts at different rates. Visible, but slow enough to read as
    // a wide shallow sheet rather than a river.
    coarse.offset.set(t * 0.0125, t * 0.0073)
    fine.offset.set(-t * 0.021, t * 0.0164)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[1600, 1600, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          blur={[26, 7]}
          resolution={reflectorResolution}
          mixBlur={0.22}
          mixStrength={6}
          roughness={roughness}
          depthScale={0}
          color={palette.waterTint}
          metalness={1}
          mirror={1}
          distortion={distort}
          distortionMap={fine}
          normalMap={coarse}
          normalScale={normalScale}
          reflectorOffset={0}
        />
      ) : (
        <meshStandardMaterial
          color={palette.waterTint}
          roughness={Math.max(roughness, 0.35)}
          metalness={0.6}
          normalMap={coarse}
          normalScale={normalScale}
        />
      )}
    </mesh>
  )
}
