'use client'

import { useMemo, useRef } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { Texture } from 'three'
import type { Palette } from '../atmosphere/palette'
import { rippleTexture } from '../materials/ripples'

/**
 * Shallow standing water over the salt plain.
 *
 * The important physical correction here is that water is a DIELECTRIC, not a
 * metal. The previous material used metalness=1 and an extremely strong planar
 * reflection, which made the surface read as chrome/polished stone. We keep the
 * planar reflector for the cinematic doubled skyline, but let roughness, blur,
 * tint and low-amplitude distortion sell shallow water instead of a mirror.
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
  distort: number
}) {
  const reflective = reflectorResolution > 0
  const ripples = useMemo(() => rippleTexture(), [])
  const texRef = useRef<Texture>(ripples)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Long wavelength drift. Faster texture travel makes the whole landscape
    // look as if it is sliding under glass.
    texRef.current.offset.set(t * 0.0038, t * 0.0021)
  })

  const waterRoughness = Math.max(0.16, Math.min(0.28, roughness + 0.07))
  const waterDistortion = Math.min(0.12, Math.max(0.025, distort * 0.42))

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[1600, 1600, 1, 1]} />
      {reflective ? (
        <MeshReflectorMaterial
          blur={[18, 5]}
          resolution={reflectorResolution}
          mixBlur={0.32}
          // Reflection should be present, not dominate the base surface.
          mixStrength={2.15}
          roughness={waterRoughness}
          depthScale={0}
          color={palette.waterTint}
          // Water is a dielectric. Planar reflection comes from the reflector,
          // not from pretending the surface is a metal.
          metalness={0}
          mirror={0.82}
          distortion={waterDistortion}
          distortionMap={ripples}
          reflectorOffset={0.012}
        />
      ) : (
        <meshPhysicalMaterial
          color={palette.waterTint}
          roughness={Math.max(waterRoughness, 0.22)}
          metalness={0}
          ior={1.333}
          clearcoat={0.18}
          clearcoatRoughness={0.22}
        />
      )}
    </mesh>
  )
}
