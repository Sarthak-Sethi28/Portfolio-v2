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
  /**
   * Lean, in radians about the view axis.
   *
   * A flooded ruin settles unevenly — foundations give way at different rates
   * and nothing stays plumb. A pier that leans reads as SUBSIDED, which is a
   * much stronger cue than one standing perfectly upright in water, and it
   * keeps a symmetrical pair from looking like a matched set of bookends.
   */
  tilt: number
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
   * How far the pier sits BELOW the waterline, in world units.
   *
   * With reflections gone there is nothing anchoring a pier to the surface, so
   * a base resting exactly at water level reads as an object placed on top of
   * the water rather than standing in it. Sinking each one — by a different
   * amount, since a flooded ruin does not settle evenly — puts the waterline
   * partway up the shaft, and a surface that cuts ACROSS a solid is the cue
   * that sells submersion.
   */
  submerge: number
  /**
   * Whether the top is broken off.
   *
   * A clean cornice on every pier reads as a maintained building. A ruin has
   * lost its crown, and an irregular top edge is the strongest silhouette cue
   * there is that something has stood a long time with nobody caring for it.
   */
  ruined: boolean
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
  /*
   * A receding colonnade, not a scatter.
   *
   * The instinct when a frame looks empty is to add objects, and it is always
   * wrong — clutter reads as busy, never as grand. What makes a vast space
   * feel full is RHYTHM IN DEPTH: the same form repeating at increasing
   * distance, each pair smaller and fainter than the last, until fog takes
   * them. The eye reads that as a procession and infers a city it cannot see.
   *
   * So the four section piers are two PAIRS, not four scattered points: a near
   * pair set wide enough to frame the aperture without crowding it, and a
   * second pair further back and inboard, continuing the line. Anything beyond
   * lives in the scatter field, deeper still.
   */
  const staging = [
    // Near pair — wide, so the aperture and the dish both have air.
    { a: -1.16, r: 2.15, h: 2.1, w: 1.6, tilt: 0.11 },
    { a: 1.2, r: 2.2, h: 2.0, w: 1.5, tilt: -0.09 },
    // Second pair — further back, drawn inboard, continuing the perspective.
    { a: -0.55, r: 5.2, h: 2.5, w: 1.4, tilt: 0.06 },
    { a: 0.6, r: 5.4, h: 2.4, w: 1.35, tilt: -0.05 },
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
    const depth = range(rng, 13, 19) * (s.w < 1.6 ? 0.62 : 1)
    /*
     * Tilting lifts a corner out of the water.
     *
     * A pier rotates about its own centre, so a lean of t radians raises the
     * rising corner by roughly half the footprint diagonal times sin(t) — and
     * on a steeply tilted mass that is enough to leave it hanging above the
     * surface with daylight underneath. Sinking it by that much again keeps
     * the low corner buried whatever the lean.
     */
    const lift = (Math.hypot(width, depth) / 2) * Math.abs(Math.sin(s.tilt))
    const submerge = range(rng, height * 0.06, height * 0.11) + lift
    return {
      submerge,
      position: [Math.sin(s.a) * r, height / 2 - submerge, Math.cos(s.a) * r * -1] as [
        number,
        number,
        number,
      ],
      rotationY: -s.a + range(rng, -0.14, 0.14),
      tilt: s.tilt,
      height,
      width,
      depth,
      shoulder: stepped
        ? {
            height: range(rng, 0.42, 0.68),
            width: range(rng, 0.55, 0.85),
            side: sign(rng) as -1 | 1,
          }
        : undefined,
      ruined: i < 2,
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
    /*
     * Pushed much further out.
     *
     * The scattered ruins were close enough to compete with the piers and the
     * arch for the eye. Held back near the horizon they do what distant
     * architecture should — give the world depth and a sense that it
     * continues — without asking to be looked at.
     */
    const r = innerRadius * 13 + Math.sqrt(rng()) * innerRadius * 22
    // Distant slabs read as taller because fog eats their base.
    const height = range(rng, 22, 68) * (1 + r / 900)
    const width = range(rng, 10, 26)
    const stepped = rng() < 0.5
    const depth = range(rng, 9, 20)

    /*
     * These are FALLING, not standing.
     *
     * A lean of three degrees reads as a surveying error. What says a city
     * went under is a skyline where things are going over — some barely off
     * plumb, some halfway to the water — so the lean is drawn from a wide
     * range and a few are pushed hard. Nothing here is load-bearing in the
     * composition, so they can be as dramatic as the eye will accept.
     */
    /*
     * Restrained lean.
     *
     * These were pushed to forty degrees to read as collapsing. At close range
     * a flat box tipped that far does not read as a falling building — it
     * reads as a flat box that has been tipped, because a real collapse has a
     * broken top and rubble and these have neither. Held far back as fog
     * silhouettes, a slight lean is all that is needed and all that survives.
     */
    const scatterTilt = sign(rng) * range(rng, 0.02, 0.13)

    // Tilting about the centre lifts one corner clear of the water, so the
    // harder it leans the deeper it has to sit.
    const tiltLift = (Math.hypot(width, depth) / 2) * Math.abs(Math.sin(scatterTilt))
    const submerge = range(rng, height * 0.1, height * 0.23) + tiltLift
    out.push({
      submerge,
      position: [Math.cos(angle) * r, height / 2 - submerge, Math.sin(angle) * r],
      rotationY: range(rng, 0, Math.PI * 2),
      tilt: scatterTilt,
      height,
      width,
      depth,
      shoulder: stepped
        ? {
            height: range(rng, 0.35, 0.7),
            width: range(rng, 0.5, 0.9),
            side: sign(rng) as -1 | 1,
          }
        : undefined,
      ruined: rng() < 0.45,
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
        tilt: 0,
        ruined: false,
        submerge: 0,
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
      tilt: side * range(rng, 0.02, 0.05),
      ruined: false,
      submerge: 0,
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
