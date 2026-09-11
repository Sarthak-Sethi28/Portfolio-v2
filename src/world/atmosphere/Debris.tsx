'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { createRng, range, SEED } from '@/lib/rng'
import type { Palette } from './palette'

/**
 * Slabs adrift above the plain.
 *
 * The world needed something whose movement you can actually TRACK. The water
 * wanders and the clouds creep, but both are diffuse — the eye registers them
 * as texture, not as motion. Birds help, though they are small and distant.
 *
 * These are solid chunks: large enough to read, slow enough to be calm, and
 * each tumbling on its own axes so no two ever agree. Crucially they are real
 * geometry rather than points or sprites, so they antialias like everything
 * else and cannot produce the sub-pixel sparkle that additive particles did.
 */
export function Debris({ count = 22, palette }: { count?: number; palette: Palette }) {
  const group = useRef<Group>(null)

  const pieces = useMemo(() => {
    const rng = createRng(SEED.debris + 17)
    return Array.from({ length: count }, () => ({
      radius: range(rng, 70, 300),
      height: range(rng, 18, 95),
      angle: range(rng, 0, Math.PI * 2),
      drift: range(rng, 0.004, 0.016) * (rng() < 0.5 ? -1 : 1),
      bob: range(rng, 1.5, 5),
      bobRate: range(rng, 0.08, 0.22),
      size: [range(rng, 1.2, 4.5), range(rng, 0.8, 3.2), range(rng, 1.0, 3.8)] as [
        number,
        number,
        number,
      ],
      // Tumble rates on three axes, deliberately unrelated.
      spin: [range(rng, -0.12, 0.12), range(rng, -0.09, 0.09), range(rng, -0.11, 0.11)] as [
        number,
        number,
        number,
      ],
      phase: range(rng, 0, Math.PI * 2),
    }))
  }, [count])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime

    g.children.forEach((child, i) => {
      const p = pieces[i]
      const a = p.angle + t * p.drift
      child.position.set(
        Math.cos(a) * p.radius,
        p.height + Math.sin(t * p.bobRate + p.phase) * p.bob,
        Math.sin(a) * p.radius - 110,
      )
      child.rotation.set(t * p.spin[0], t * p.spin[1], t * p.spin[2])
    })
  })

  return (
    <group ref={group}>
      {pieces.map((p, i) => (
        <mesh key={i}>
          <boxGeometry args={p.size} />
          <meshStandardMaterial
            color={palette.monolith}
            roughness={0.9}
            metalness={0}
            envMapIntensity={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}
