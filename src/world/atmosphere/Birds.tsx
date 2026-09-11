'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, type Group } from 'three'
import { createRng, range, SEED } from '@/lib/rng'
import type { Palette } from './palette'

/**
 * Birds wheeling over the plain.
 *
 * The world was inert. A camera breath alone is not life — the eye needs
 * something with its own intent moving through the frame, and a still image
 * with a drifting camera still reads as a photograph rather than a place.
 *
 * Deliberately distant silhouettes: at this range a bird is a few dark pixels
 * with a wingbeat, so two angled planes per bird is the whole model. They
 * travel long elliptical circuits at different rates and heights, so the
 * flock never forms a visible pattern and never all leaves frame at once.
 */
interface Bird {
  radius: number
  height: number
  speed: number
  phase: number
  tilt: number
  scale: number
  beat: number
}

export function Birds({ count = 9, palette }: { count?: number; palette: Palette }) {
  const group = useRef<Group>(null)

  const birds = useMemo<Bird[]>(() => {
    const rng = createRng(SEED.stars + 41)
    return Array.from({ length: count }, () => ({
      radius: range(rng, 90, 260),
      height: range(rng, 34, 88),
      // Slow. A bird crossing the frame in two seconds reads as an insect.
      speed: range(rng, 0.022, 0.055) * (rng() < 0.5 ? -1 : 1),
      phase: range(rng, 0, Math.PI * 2),
      tilt: range(rng, -0.22, 0.22),
      scale: range(rng, 0.8, 1.7),
      beat: range(rng, 2.6, 4.4),
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
        b.height + Math.sin(a * 2.3 + b.phase) * 4.5,
        Math.sin(a) * b.radius - 120,
      )
      // Face along the tangent of travel.
      child.rotation.set(b.tilt, -a + (b.speed > 0 ? Math.PI / 2 : -Math.PI / 2), 0)

      // Wingbeat: the two wing planes fold and open.
      const flap = Math.sin(t * b.beat + b.phase) * 0.55
      const [left, right] = child.children
      if (left && right) {
        left.rotation.z = 0.35 + flap
        right.rotation.z = -0.35 - flap
      }
    })
  })

  return (
    <group ref={group}>
      {birds.map((b, i) => (
        <group key={i} scale={b.scale}>
          {[1, -1].map((side) => (
            <mesh key={side} position={[side * 0.5, 0, 0]}>
              <planeGeometry args={[1.6, 0.26]} />
              <meshBasicMaterial
                color={palette.monolith}
                side={DoubleSide}
                transparent
                opacity={0.72}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
