import { createRng, range, rangeInt, sign, SEED } from '@/lib/rng'

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
  /**
   * Optional stepped shoulder — a lower mass butted against one side.
   *
   * The reference frame's slabs are not plain boxes; several carry an L-shaped
   * step, and that notch is most of what stops a silhouette reading as a
   * rectangle. Expressed as fractions of the parent so it scales with it.
   */
  shoulder?: {
    /** Fraction of parent height. */
    height: number
    /** Fraction of parent width. */
    width: number
    /** -1 attaches to the left face, 1 to the right. */
    side: -1 | 1
  }
  /**
   * Architectural detail.
   *
   * A rectangular prism reads as a primitive no matter how it is textured.
   * What makes cast concrete read as BUILT is the vocabulary of how it was
   * poured: a cornice oversailing the top, a plinth spreading at the base, and
   * horizontal reveals where one lift of formwork met the next. All three are
   * silhouette-level cues, so they survive being seen almost entirely in
   * shadow — which is how these are seen.
   */
  detail: {
    /** Oversail of the cap, as a fraction of width. 0 means no cornice. */
    cornice: number
    /** Spread of the base plinth, as a fraction of width. 0 means none. */
    plinth: number
    /** Number of recessed horizontal reveal bands. */
    reveals: number
  }
}

/**
 * The four section monoliths, evenly distributed on a ring around the origin.
 *
 * Evenly spaced by count rather than at fixed compass points, so adding a fifth
 * section redistributes the ring instead of colliding with the fourth.
 */
export function sectionRing(count: number, radius: number): Placement[] {
  if (count <= 0) return []

  /**
   * Staged to a specific frame, not scattered.
   *
   * The reference composition is: a wide mass cropped by the left edge, a
   * clear gap, a tall narrow tower near the centre, another gap showing the
   * dish and the horizon, then wide masses cropped by the right edge. The
   * GAPS are the composition — they are what the eye travels through, and
   * what lets the aperture and the mirrored plain be seen at all.
   *
   * `a` is the bearing from the camera axis, `r` scales the ring radius, `h`
   * and `w` scale height and width. Width is explicit per slot because a
   * random width on a near mass either blocks the centre or looks like a post.
   */
  const staging = [
    { a: -1.52, r: 1.02, h: 1.85, w: 2.6 }, // wide mass, crops the left edge
    { a: 1.55, r: 1.08, h: 1.7, w: 2.5 }, // wide mass, crops the right edge
    { a: -1.05, r: 3.2, h: 2.6, w: 0.72 }, // the tall tower, well back and clear of the ring
    { a: 1.08, r: 2.6, h: 1.45, w: 1.5 }, // mid right, clear of the ring
  ]

  return Array.from({ length: count }, (_, i) => {
    const s = staging[i % staging.length]
    // Sections beyond the staged four step progressively further out.
    const tier = Math.floor(i / staging.length)
    const r = radius * s.r * (1 + tier * 0.8)

    const rng = createRng(SEED.fieldMonoliths + i * 7919)
    // Proportion is the whole argument.
    //
    // These were 9-13 wide against 60-90 tall, which is a column. The
    // reference frame's slabs are MASSES — wide, blocky, closer to a wall than
    // a tower, so that a single one can fill a quarter of the frame and read
    // as architecture rather than as a post.
    const height = range(rng, 26, 34) * s.h
    const width = range(rng, 11, 14) * s.w
    // Roughly two in three carry a step. Uniformly notched reads as a pattern;
    // never notched reads as a box.
    const stepped = rng() < 0.66
    return {
      position: [Math.sin(s.a) * r, height / 2, Math.cos(s.a) * r * -1] as [
        number,
        number,
        number,
      ],
      rotationY: -s.a + range(rng, -0.14, 0.14),
      height,
      width,
      depth: range(rng, 13, 19),
      shoulder: stepped
        ? {
            height: range(rng, 0.42, 0.68),
            width: range(rng, 0.55, 0.85),
            side: sign(rng) as -1 | 1,
          }
        : undefined,
      detail: {
        cornice: rng() < 0.7 ? range(rng, 0.03, 0.075) : 0,
        plinth: rng() < 0.55 ? range(rng, 0.04, 0.09) : 0,
        reveals: rangeInt(rng, 1, 4),
      },
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
    let angle = range(rng, 0, Math.PI * 2)
    // Clear the central corridor so the aperture always has open sky behind
    // it — but push each pier away from the axis on the side it is ALREADY
    // on. Pushing everything the same direction, as a first attempt did,
    // simply moves the whole field left and bunches it there.
    /*
     * Clear the corridor the camera looks down.
     *
     * A pier sits at (cos a * r, _, sin a * r) and the camera looks toward -Z,
     * so "directly ahead" is a = -PI/2, NOT a = 0. An earlier version measured
     * deviation from the wrong axis and cleared an arc off to the side, which
     * is why piers kept appearing THROUGH the aperture however wide the
     * exclusion was made.
     *
     * dev is the signed angular distance from straight ahead, wrapped to
     * [-PI, PI]; anything inside the corridor is pushed out on the side it is
     * already on, so the field opens rather than shifting.
     */
    const AHEAD = -Math.PI / 2
    const CLEAR = 0.62
    const dev = Math.atan2(Math.sin(angle - AHEAD), Math.cos(angle - AHEAD))
    if (Math.abs(dev) < CLEAR) {
      angle += Math.sign(dev || 1) * (CLEAR - Math.abs(dev))
    }
    // sqrt keeps the scatter area-uniform instead of clustering at the centre.
    const r = innerRadius * 1.7 + Math.sqrt(rng()) * innerRadius * 11
    // Distant slabs read as taller because fog eats their base.
    const height = range(rng, 16, 52) * (1 + r / 520)
    const width = range(rng, 10, 26)
    const stepped = rng() < 0.5
    out.push({
      position: [Math.cos(angle) * r, height / 2, Math.sin(angle) * r],
      rotationY: range(rng, 0, Math.PI * 2),
      height,
      width,
      depth: range(rng, 9, 20),
      shoulder: stepped
        ? {
            height: range(rng, 0.35, 0.7),
            width: range(rng, 0.5, 0.9),
            side: sign(rng) as -1 | 1,
          }
        : undefined,
      detail: {
        cornice: rng() < 0.5 ? range(rng, 0.03, 0.06) : 0,
        plinth: 0,
        reveals: rangeInt(rng, 0, 2),
      },
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
        detail: { cornice: 0.05, plinth: 0.04, reveals: 2 },
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
      detail: { cornice: 0.05, plinth: 0.04, reveals: 2 },
    })
  }
  return out
}

/** Camera framing distance that keeps `count` colonnade pillars in shot. */
export function colonnadeDepth(count: number, spacing = 17): number {
  return (Math.floor(count / 2) + (count % 2 === 1 ? 1 : 0) + 1) * spacing
}
