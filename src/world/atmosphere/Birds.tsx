'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { type Group } from 'three'
import { createRng, range, SEED } from '@/lib/rng'
import type { Palette } from './palette'

interface Bird {
  radius: number
  height: number
  speed: number
  phase: number
  scale: number
  beat: number
  bob: number
  glide: number
}

function Gull({ palette }: { palette: Palette }) {
  return (
    <group>
      {/* Body points along local +X. Real thickness is important once a bird is
          large enough to be noticed; billboard wings read as paper immediately. */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <capsuleGeometry args={[0.11, 0.48, 5, 10]} />
        <meshStandardMaterial color="#d9d9d4" roughness={0.84} metalness={0} />
      </mesh>

      <mesh position={[0.34, 0.045, 0]}>
        <sphereGeometry args={[0.145, 12, 8]} />
        <meshStandardMaterial color="#e5e3dc" roughness={0.8} metalness={0} />
      </mesh>

      <mesh position={[0.49, 0.03, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.052, 0.18, 5]} />
        <meshStandardMaterial color="#b88e5b" roughness={0.72} metalness={0} />
      </mesh>

      <mesh position={[-0.39, 0, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 0.44, 1]}>
        <coneGeometry args={[0.17, 0.36, 4]} />
        <meshStandardMaterial color="#c7c8c3" roughness={0.9} metalness={0} />
      </mesh>

      {/* Wing roots. These are the only children animated by the flock loop. */}
      <group position={[0, 0.03, 0.08]}>
        <mesh position={[-0.02, 0, 0.42]} scale={[0.58, 0.055, 0.34]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#d8d8d3" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.1, -0.015, 0.86]} rotation={[0.03, 0.18, 0]} scale={[0.44, 0.035, 0.52]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#b8bab7" roughness={0.96} metalness={0} />
        </mesh>
      </group>

      <group position={[0, 0.03, -0.08]}>
        <mesh position={[-0.02, 0, -0.42]} scale={[0.58, 0.055, 0.34]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color="#d8d8d3" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[-0.1, -0.015, -0.86]} rotation={[-0.03, -0.18, 0]} scale={[0.44, 0.035, 0.52]}>
          <sphereGeometry args={[1, 10, 6]} />
          <meshStandardMaterial color="#b8bab7" roughness={0.96} metalness={0} />
        </mesh>
      </group>

      {/* Dark underside keeps the silhouette readable against the bright sky. */}
      <mesh position={[-0.01, -0.075, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 0.45, 0.72]}>
        <capsuleGeometry args={[0.085, 0.33, 4, 8]} />
        <meshStandardMaterial color={palette.monolith} roughness={0.97} metalness={0} />
      </mesh>
    </group>
  )
}

export function Birds({ count = 7, palette }: { count?: number; palette: Palette }) {
  const group = useRef<Group>(null)

  const birds = useMemo<Bird[]>(() => {
    const rng = createRng(SEED.stars + 41)
    return Array.from({ length: count }, () => ({
      radius: range(rng, 65, 165),
      height: range(rng, 25, 52),
      speed: range(rng, 0.018, 0.036) * (rng() < 0.5 ? -1 : 1),
      phase: range(rng, 0, Math.PI * 2),
      scale: range(rng, 0.95, 1.5),
      beat: range(rng, 2.0, 3.0),
      bob: range(rng, 1.8, 4.2),
      glide: range(rng, 0.35, 0.72),
    }))
  }, [count])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime

    g.children.forEach((child, i) => {
      const b = birds[i]
      const a = b.phase + t * b.speed

      child.position.set(
        Math.cos(a) * b.radius,
        b.height + Math.sin(a * 1.8 + b.phase) * b.bob,
        Math.sin(a) * b.radius - 116,
      )

      child.rotation.set(
        Math.sin(a * 1.25 + b.phase) * 0.08,
        -a + (b.speed > 0 ? Math.PI / 2 : -Math.PI / 2),
        (b.speed > 0 ? -1 : 1) * 0.12 + Math.sin(a * 0.7 + b.phase) * 0.05,
      )

      const gull = child.children[0] as Group | undefined
      if (!gull) return
      const left = gull.children[4]
      const right = gull.children[5]

      // Mostly glide, with soft bursts of wing motion. This avoids the robotic
      // metronome look of a sine-driven flap on every frame.
      const carrier = Math.sin(t * b.beat + b.phase)
      const flap = Math.max(-0.28, carrier) * (1 - b.glide) * 0.72
      if (left && right) {
        left.rotation.x = 0.07 + flap
        right.rotation.x = -0.07 - flap
      }
    })
  })

  return (
    <group ref={group}>
      {birds.map((b, i) => (
        <group key={i} scale={b.scale}>
          <Gull palette={palette} />
        </group>
      ))}
    </group>
  )
}
