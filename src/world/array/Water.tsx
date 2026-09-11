'use client'

import { useMemo } from 'react'
import { MeshReflectorMaterial } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector2 } from 'three'
import type { Palette } from '../atmosphere/palette'
import { rippleTexture, waterNormalTexture } from '../materials/ripples'

/**
 * A shallow flooded salt plain.
 *
 * The old material was a metallic mirror. That gives a clean reflection but it
 * cannot look like water: real water is a dielectric with a Fresnel-like
 * grazing reflection and a field of tiny normals that break the highlight.
 *
 * We keep MeshReflectorMaterial as the inexpensive planar reflection layer,
 * then place a transparent physical highlight layer a centimetre above it.
 * Both use long, mipmapped waves only, so the surface reads as water without
 * reintroducing high-frequency sparkle during camera motion.
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
  const maxAniso = useThree((s) => s.gl.capabilities.getMaxAnisotropy())
  const distortion = useMemo(() => rippleTexture().clone(), [])
  const normals = useMemo(() => waterNormalTexture().clone(), [])
  const normalScale = useMemo(() => new Vector2(0.24, 0.24), [])

  useMemo(() => {
    distortion.repeat.set(7, 7)
    normals.repeat.set(13, 13)
    distortion.anisotropy = maxAniso
    normals.anisotropy = maxAniso
    distortion.needsUpdate = true
    normals.needsUpdate = true
  }, [distortion, normals, maxAniso])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Slow enough that the water never looks like a conveyor belt. The two
    // maps travel in different directions so the highlight and reflection do
    // not lock together into one obvious repeating texture.
    distortion.offset.set(t * 0.0019, t * 0.0011)
    normals.offset.set(-t * 0.0026, t * 0.0017)
  })

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[1600, 1600, 1, 1]} />
        {reflective ? (
          <MeshReflectorMaterial
            blur={[42, 18]}
            resolution={reflectorResolution}
            mixBlur={0.55}
            mixStrength={1.55}
            roughness={Math.max(0.18, roughness)}
            depthScale={0}
            color={palette.waterTint}
            // Water is a dielectric. The planar reflection is already explicit;
            // setting metalness to 1 was double-counting reflection and made
            // the surface read as polished chrome/stone.
            metalness={0}
            mirror={0.78}
            distortion={distort * 0.42}
            distortionMap={distortion}
            reflectorOffset={0}
          />
        ) : (
          <meshStandardMaterial
            color={palette.waterTint}
            roughness={Math.max(roughness, 0.28)}
            metalness={0}
            envMapIntensity={0.85}
          />
        )}
      </mesh>

      {/* Physical surface sheen. This is what creates the broad moving light
          breakup visible in high-end WebGL water without making the planar
          reflection itself noisy. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} renderOrder={2}>
        <planeGeometry args={[1600, 1600, 1, 1]} />
        <meshPhysicalMaterial
          color={palette.waterTint}
          metalness={0}
          roughness={0.16}
          normalMap={normals}
          normalScale={normalScale}
          clearcoat={1}
          clearcoatRoughness={0.11}
          ior={1.333}
          envMapIntensity={1.05}
          transparent
          opacity={0.19}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
