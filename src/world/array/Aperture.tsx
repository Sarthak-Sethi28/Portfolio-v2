'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, type Mesh, type MeshBasicMaterial } from 'three'
import type { Palette } from '../atmosphere/palette'

/**
 * The aperture — the threshold to World 2.
 *
 * It was a plain torus, which reads as a hoop rather than as a structure
 * somebody built. A ring of this scale would be ASSEMBLED, and what sells that
 * is the vocabulary of assembly:
 *
 *  - a squared cross-section, so it has faces that catch light rather than a
 *    single rolling highlight
 *  - segment collars at the joints between cast sections, the way a real ring
 *    of this size would be poured or forged in parts
 *  - a recessed inner channel, so the opening has depth instead of being a
 *    hole cut in a tube
 *  - splayed buttresses carrying it into the water, rather than the ring
 *    apparently balancing on nothing
 */
export function Aperture({
  palette,
  radius = 42,
  charge = 0,
}: {
  palette: Palette
  radius?: number
  /** 0 to 1 while the visitor holds to enter. */
  charge?: number
}) {
  const glow = useRef<Mesh>(null)
  const tube = radius * 0.085

  // Segment collars: slightly larger blocks straddling each joint.
  const SEGMENTS = 12
  const collars = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => {
        const a = (i / SEGMENTS) * Math.PI * 2
        return { a, x: Math.cos(a) * radius, y: Math.sin(a) * radius }
      }),
    [radius],
  )

  useFrame(({ clock }) => {
    const mat = glow.current?.material as MeshBasicMaterial | undefined
    if (!mat) return
    const t = clock.elapsedTime
    const pulse = 0.5 + 0.5 * Math.sin(t * (0.5 + charge * 6))
    mat.opacity = MathUtils.lerp(mat.opacity, 0.04 + pulse * 0.04 + charge * 0.55, 0.08)
  })

  return (
    <group position={[-18, radius + 1.2, -168]}>
      {/* Main ring. radialSegments 4 gives a squared section with flat faces. */}
      <mesh rotation={[0, 0, Math.PI / 4]} castShadow>
        <torusGeometry args={[radius, tube, 4, 128]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.62} metalness={0} />
      </mesh>

      {/* Recessed inner channel: a thinner ring set inside the main section,
          so the opening reads as a machined bore rather than a hoop. */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[radius - tube * 0.55, tube * 0.4, 4, 128]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.4} metalness={0} />
      </mesh>

      {/* Segment collars at the cast joints. */}
      {collars.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, 0]} rotation={[0, 0, c.a]} castShadow>
          <boxGeometry args={[tube * 0.5, tube * 3.1, tube * 3.1]} />
          <meshStandardMaterial color={palette.monolith} roughness={0.55} metalness={0} />
        </mesh>
      ))}

      {/* Membrane across the opening. */}
      <mesh ref={glow}>
        <circleGeometry args={[radius - tube * 1.2, 96]} />
        <meshBasicMaterial
          color={palette.sunColor}
          transparent
          opacity={0.06}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      {/* Splayed buttresses down into the water. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh
            position={[s * radius * 0.74, -radius * 0.79, 0]}
            rotation={[0, 0, s * 0.42]}
            castShadow
          >
            <boxGeometry args={[tube * 1.5, radius * 0.62, tube * 2.2]} />
            <meshStandardMaterial color={palette.monolith} roughness={0.7} metalness={0} />
          </mesh>
          {/* Footing spreading where it meets the plain. */}
          <mesh position={[s * radius * 0.86, -radius * 1.04, 0]} castShadow>
            <boxGeometry args={[tube * 3.4, tube * 1.5, tube * 3.4]} />
            <meshStandardMaterial color={palette.monolith} roughness={0.78} metalness={0} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
