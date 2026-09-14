'use client'

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { DoubleSide, Shape, ShapeGeometry, type Group } from 'three'
import { createRng, range, SEED } from '@/lib/rng'
import { cinematicSample } from '../cinematic/cinematicState'
import type { Palette } from './palette'

/**
 * Birds wheeling over the plain.
 *
 * The first version was two rectangles per bird, which reads as a cross. A
 * bird silhouette is specific and the eye knows it immediately:
 *
 *  - the wing SWEEPS BACK from the shoulder and TAPERS to a point, with a
 *    convex leading edge and a concave trailing edge
 *  - the two wings sit at a dihedral, forming a shallow V rather than a flat line
 *  - the body is a short spindle, longer behind the wings than in front
 *  - and critically, a turning bird BANKS into the turn; one that stays level
 *    reads as a paper aeroplane on a wire
 *
 * The flap is asymmetric in time — the downstroke is faster than the recovery,
 * because that is what generates lift and what a real wingbeat looks like.
 */
interface Bird {
  radius: number
  height: number
  speed: number
  flee: number
  fleeOut: number
  fleeUp: number
  fleeLag: number
  fleeSpin: number
  phase: number
  scale: number
  beat: number
  /** Vertical wander, so the flock is not a flat disc. */
  bob: number
}

/** One wing, pointing along +X from the shoulder at the origin. */
function wingShape(): Shape {
  const s = new Shape()
  s.moveTo(0, 0.06)
  // Leading edge: convex, sweeping out and back.
  s.quadraticCurveTo(0.55, 0.18, 1.0, 0.02)
  // Tip.
  s.lineTo(1.02, -0.02)
  // Trailing edge: concave, tucking back toward the shoulder.
  s.quadraticCurveTo(0.5, -0.12, 0, -0.08)
  s.closePath()
  return s
}

export function Birds({ count = 11, palette }: { count?: number; palette: Palette }) {
  const group = useRef<Group>(null)

  const wing = useMemo(() => new ShapeGeometry(wingShape(), 12), [])

  const birds = useMemo<Bird[]>(() => {
    const rng = createRng(SEED.stars + 41)
    return Array.from({ length: count }, () => ({
      radius: range(rng, 55, 190),
      height: range(rng, 26, 62),
      // Slow. A bird crossing frame in two seconds reads as an insect.
      speed: range(rng, 0.022, 0.055) * (rng() < 0.5 ? -1 : 1),
      phase: range(rng, 0, Math.PI * 2),
      scale: range(rng, 1.6, 3.6),
      beat: range(rng, 2.2, 3.6),
      bob: range(rng, 2.5, 7),
      /*
       * THE ESCAPE, precomputed.
       *
       * Every bird's flight away from the portal is decided here, once, at
       * mount: which way it breaks, how hard, how steeply it climbs, how much
       * sooner than its neighbours it panics. Nothing is drawn inside the
       * frame loop, because a random number per frame is a different world
       * every frame — the flock would jitter rather than flee, and scrubbing
       * back to the same second would produce a different picture each time.
       *
       * The flock also has to come APART. Real birds do not leave in
       * formation; the thing that reads as panic is that they stop agreeing
       * with each other, so the stagger and the direction are per bird.
       */
      flee: range(rng, 0.75, 1.0) * (rng() < 0.5 ? -1 : 1),
      fleeOut: range(rng, 230, 430),
      fleeUp: range(rng, 55, 150),
      fleeLag: range(rng, 0, 0.42),
      fleeSpin: range(rng, 2.4, 5.2),
    }))
  }, [count])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const t = clock.elapsedTime

    g.children.forEach((child, i) => {
      const b = birds[i]
      /*
       * Panic, staggered per bird and eased in.
       *
       * `scatter` is the flock's alarm; each bird answers it a little later
       * than the next and then commits. Squared so the break is sudden rather
       * than a drift outward.
       */
      const alarm = Math.min(1, Math.max(0, (cinematicSample.scatter - b.fleeLag) / (1 - b.fleeLag)))
      const flee = alarm * alarm

      // They fly FASTER as they go — a fleeing bird is not a circling bird
      // played at the same speed on a wider arc.
      const a = b.phase + t * b.speed * (1 + flee * b.fleeSpin)

      child.position.set(
        Math.cos(a) * (b.radius + flee * b.fleeOut * b.flee),
        b.height + Math.sin(a * 2.3 + b.phase) * b.bob + flee * b.fleeUp,
        Math.sin(a) * (b.radius + flee * b.fleeOut) - 125,
      )

      // Heading along the tangent, and BANKED into the turn. A circling bird
      // rolls toward the centre; flying level reads as a model on a wire.
      const bank = b.speed > 0 ? -0.42 : 0.42
      child.rotation.set(0, -a + (b.speed > 0 ? Math.PI / 2 : -Math.PI / 2), bank)

      // Asymmetric wingbeat: a fast downstroke and a slower recovery, which is
      // what a real beat looks like. A pure sine reads as mechanical.
      // The beat quickens with the panic, which is most of what sells it.
      const cycle = (t * b.beat * (1 + flee * 1.9) + b.phase) % (Math.PI * 2)
      const raw = Math.sin(cycle)
      const flap = raw > 0 ? Math.pow(raw, 0.55) : -Math.pow(-raw, 1.7)

      const [left, right] = child.children
      if (left && right) {
        // Dihedral: a shallow V even at rest, hinging at the shoulder.
        left.rotation.z = 0.22 + flap * 0.78
        right.rotation.z = -0.22 - flap * 0.78
      }
    })
  })

  return (
    <group ref={group}>
      {birds.map((b, i) => (
        <group key={i} scale={b.scale}>
          {/* Wings, mirrored about the body. */}
          <mesh geometry={wing}>
            <meshBasicMaterial
              color={palette.monolith}
              side={DoubleSide}
              transparent
              opacity={0.88}
              toneMapped={false}
            />
          </mesh>
          <mesh geometry={wing} scale={[-1, 1, 1]}>
            <meshBasicMaterial
              color={palette.monolith}
              side={DoubleSide}
              transparent
              opacity={0.88}
              toneMapped={false}
            />
          </mesh>
          {/* Body: a short spindle, longer behind the wings than in front. */}
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]} scale={[1, 1, 0.45]}>
            <capsuleGeometry args={[0.055, 0.34, 2, 6]} />
            <meshBasicMaterial color={palette.monolith} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
