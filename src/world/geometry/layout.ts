import { createRng, range, SEED } from '@/lib/rng'

/**
 * Placement maths for both worlds.
 *
 * Pure functions of (count, config) so they can be unit-tested without a
 * renderer, and so the "content may churn" guarantee in the spec is a property
 * we assert rather than a convention we hope holds. Nothing here may assume a
 * particular number of sections or projects.
 */

export interface Placement {
  position: [number, number, number]
  rotationY: number
  /** Height in world units. */
  height: number
  width: number
  depth: number
}

/**
 * The four section monoliths, evenly distributed on a ring around the origin.
 *
 * Evenly spaced by count rather than at fixed compass points, so adding a fifth
 * section redistributes the ring instead of colliding with the fourth.
 */
export function sectionRing(count: number, radius: number): Placement[] {
  if (count <= 0) return []
  // Start a little off-axis so no monolith sits dead-centre of the opening
  // shot and blocks the name.
  const offset = Math.PI / count + 0.90

  return Array.from({ length: count }, (_, i) => {
    const angle = offset + (i / count) * Math.PI * 2
    // Deterministic per-index variation keeps the ring from reading as a
    // turntable of identical objects.
    const rng = createRng(SEED.fieldMonoliths + i * 7919)
    const height = range(rng, 26, 38)
    return {
      position: [Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius] as [
        number,
        number,
        number,
      ],
      rotationY: -angle + range(rng, -0.12, 0.12),
      height,
      width: range(rng, 7, 10.5),
      depth: range(rng, 6, 9),
    }
  })
}

/**
 * Decorative monoliths in the middle distance.
 *
 * These carry no navigation, which is why `fieldDensity` is allowed to drive
 * their count all the way to zero. Scattered in an annulus beyond the section
 * ring so they never occlude a clickable monolith from the rest position.
 */
export function scatterField(count: number, innerRadius: number): Placement[] {
  const rng = createRng(SEED.fieldMonoliths)
  const out: Placement[] = []

  for (let i = 0; i < count; i++) {
    const angle = range(rng, 0, Math.PI * 2)
    // sqrt keeps the scatter area-uniform instead of clustering at the centre.
    const r = innerRadius * 1.5 + Math.sqrt(rng()) * innerRadius * 5.5
    // Distant slabs read as taller because fog eats their base.
    const height = range(rng, 14, 52) * (1 + r / 420)
    out.push({
      position: [Math.cos(angle) * r, height / 2, Math.sin(angle) * r],
      rotationY: range(rng, 0, Math.PI * 2),
      height,
      width: range(rng, 4, 13),
      depth: range(rng, 4, 11),
    })
  }
  return out
}

/**
 * The colonnade of World 2 — two facing rows receding into fog, one pillar per
 * project, nearest pair first.
 *
 * An odd project count puts the final pillar centred at the far end rather than
 * leaving a gap, so the corridor always terminates deliberately.
 */
export function colonnade(
  count: number,
  opts: { spacing?: number; halfWidth?: number } = {},
): Placement[] {
  const spacing = opts.spacing ?? 17
  const halfWidth = opts.halfWidth ?? 11
  if (count <= 0) return []

  const rng = createRng(SEED.debris)
  const out: Placement[] = []
  const pairs = Math.floor(count / 2)
  const odd = count % 2 === 1

  for (let i = 0; i < count; i++) {
    const height = range(rng, 30, 40)
    const width = range(rng, 5.5, 7)

    if (odd && i === count - 1) {
      // Terminal pillar, centred on the axis past the last pair.
      out.push({
        position: [0, height / 2, -(pairs + 1) * spacing],
        rotationY: 0,
        height,
        width,
        depth: width,
      })
      continue
    }

    const row = Math.floor(i / 2)
    const side = i % 2 === 0 ? -1 : 1
    out.push({
      position: [side * halfWidth, height / 2, -(row + 1) * spacing],
      rotationY: side * range(rng, 0.02, 0.07),
      height,
      width,
      depth: width,
    })
  }
  return out
}

/** Camera framing distance that keeps `count` colonnade pillars in shot. */
export function colonnadeDepth(count: number, spacing = 17): number {
  return (Math.floor(count / 2) + (count % 2 === 1 ? 1 : 0) + 1) * spacing
}
