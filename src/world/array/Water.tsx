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

  // Tiles must be SMALL relative to the plain.
  //
  // At a repeat of 5 across 1600 units each tile was 320 units wide, so the
  // wave field's own interference pattern showed up at the scale of the whole
  // scene — concentric swirls that read as an oil slick, not water. Waves
  // should be a few metres across, which means many more repeats.
  const coarse = useMemo(() => waterNormals(70, maxAniso), [maxAniso])
  const fine = useMemo(() => waterNormals(210, maxAniso), [maxAniso])
    // Low. An animated normal map on a near-mirror surface changes the specular
  // response every frame, and at high amplitude that sparkles — a genuine
  // per-frame change, unlike the camera shimmer.
  // Enough slope for a crest to catch light, not so much that the surface
  // stops reading as a thin sheet on a flat bed.
  const normalScale = useMemo(() => new Vector2(0.16, 0.16), [])

  // The textures are memoised, so the frame loop can close over them directly
  // — no ref, and nothing dereferenced during render.
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Crossing drifts at different rates. Visible, but slow enough to read as
    // a wide shallow sheet rather than a river.
    // Visibly moving. Swell rolls one way, chop crosses it.
    // Scaled to the new tiling so the apparent speed stays calm.
    coarse.offset.set(t * 0.0055, t * 0.0034)
    fine.offset.set(-t * 0.0095, t * 0.0071)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[1600, 1600, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          blur={[30, 9]}
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
