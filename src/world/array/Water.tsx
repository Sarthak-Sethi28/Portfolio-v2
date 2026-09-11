'use client'

import { useMemo, useRef } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Texture } from 'three'
import type { Palette } from '../atmosphere/palette'
import { rippleTexture } from '../materials/ripples'

/**
 * The salt plain: a centimetre of standing water over a flat bed.
 *
 * This single plane does most of the work in the reference frames. Every
 * vertical in the scene is doubled by it, which is what makes the monoliths
 * read as enormous.
 *
 * It was a PERFECT mirror, and a perfect mirror reads as polished stone, not
 * as water. What makes water look like water at this depth is not waves — it
 * is a slow, low-amplitude wander in the reflection. The distortion map drifts
 * continuously so the mirrored world breathes rather than sitting frozen.
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
  /** Rain ripple amount. Low but never zero — still water still moves. */
  distort: number
}) {
  const reflective = reflectorResolution > 0
  const ripples = useMemo(() => rippleTexture(), [])
  const texRef = useRef<Texture>(ripples)

  useFrame(({ clock }) => {
    // Two axes at different rates, so the surface never repeats a state.
    const t = clock.elapsedTime
    texRef.current.offset.set(t * 0.0075, t * 0.0043)
  })

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      {/* Sized to sit inside the sky dome; beyond that the plain would render
          against nothing at all. */}
      <planeGeometry args={[1600, 1600, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          // Just enough to read as a centimetre of water rather than glass.
          //
          // This was [160,38] and then [90,22]; at those values the reflection
          // smeared into flat darkness and the mirrored plain — half the
          // composition — was simply absent.
          blur={[26, 7]}
          resolution={reflectorResolution}
          mixBlur={0.22}
          mixStrength={6}
          roughness={roughness}
          // depthScale fades the reflection by distance from the surface, and
          // enabled it erased almost everything the plain should mirror.
          depthScale={0}
          color={palette.waterTint}
          metalness={1}
          mirror={1}
          distortion={distort}
          distortionMap={ripples}
          reflectorOffset={0}
        />
      ) : (
        <meshStandardMaterial color={palette.waterTint} roughness={Math.max(roughness, 0.35)} metalness={0.6} />
      )}
    </mesh>
  )
}
