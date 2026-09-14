/**
 * THE CINEMATIC TIMELINE — a pure function of elapsed seconds.
 *
 * Fifteen seconds, day to night. Every system in the world reads its own value
 * out of one sample, so there is exactly one place that decides what moment it
 * is and no two systems can disagree about it.
 *
 * PURE, and that is the whole design. No component accumulates its own
 * animation state, nothing integrates a velocity, nothing eases toward a
 * target. Scrubbing from second 11 back to second 3 has to render precisely
 * the frame that playing forwards produced, and anything that accumulates
 * breaks that the moment you seek. It also means a dropped frame costs
 * nothing: the next frame asks for the time it actually is and gets the right
 * answer, rather than being one integration step behind forever.
 */

/** Total running time, seconds. Matches the Blender clip exactly. */
export const DURATION = 15

/** 0 before `a`, 1 after `b`, smoothstepped between. */
export function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** Rises to 1 at `peak`, falls back to 0 by `b`. For one-off events. */
export function pulse(t: number, a: number, peak: number, b: number): number {
  return t < peak ? span(t, a, peak) : 1 - span(t, peak, b)
}

/**
 * Heavier than a smoothstep: slow to start, then committed.
 *
 * Used where something with real mass begins to move. A smoothstep is
 * symmetrical and reads as a machine easing a light object; this holds still
 * noticeably longer before it goes, which is how something that weighs a great
 * deal announces that it has started.
 */
export function heavy(t: number, a: number, b: number): number {
  const x = span(t, a, b)
  return x * x * (3 - 2 * x)
}

export interface CinematicSample {
  /** 0..1 across the whole piece. */
  progress: number
  /** Local water agitation around the portal. */
  disturbance: number
  /** Birds break formation and flee. */
  scatter: number
  /** The ocean draws inward. */
  pull: number
  /** Columns sink. 1 is fully submerged. */
  pillarDescent: number
  /** The held breath before the machine wakes. 1 means hold everything. */
  stillness: number
  /** Time to drive the Blender mixer with, in seconds. */
  portalTime: number
  /** How far the ignition has travelled the ring, 0..1. */
  ignition: number
  /** Steady-state power once lit. */
  power: number
  /** The single water shockwave. */
  shockwave: number
  /** Warmth collapsing out of the sky. */
  twilight: number
  /** Authoritative night level during the cinematic. */
  night: number
  /** Camera approach (Step 5 owns the path; this is the value it will read). */
  approach: number
  /** Passing through the aperture. */
  through: number
  /** The near-black interstitial. */
  blackout: number
  /** Landed. */
  destination: number
}

/** A single shared sample object, mutated in place. */
export function createSample(): CinematicSample {
  return {
    progress: 0, disturbance: 0, scatter: 0, pull: 0, pillarDescent: 0,
    stillness: 0, portalTime: 0, ignition: 0, power: 0, shockwave: 0,
    twilight: 0, night: 0, approach: 0, through: 0, blackout: 0, destination: 0,
  }
}

/**
 * Write the state of the world at `t` seconds into `out`.
 *
 * Mutates rather than allocating: this runs every frame, and a fresh object
 * per frame is sixty new allocations a second for no benefit when every
 * consumer reads it and discards it within the same frame.
 */
export function sampleCinematic(t: number, out: CinematicSample): CinematicSample {
  out.progress = Math.min(1, Math.max(0, t / DURATION))

  // 02-04. Local water only. The whole ocean must not change speed.
  out.disturbance = span(t, 1.15, 3.2) * (1 - span(t, 11.5, 13.5) * 0.55)
  out.pull = span(t, 3.0, 4.1)

  // 03. Birds flee. Gone from the composition by about 3.3.
  out.scatter = span(t, 2.0, 3.3)

  // 05. Columns descend, 4.0 to 5.0 with per-pillar stagger applied by the
  // caller — this is the envelope, not the individual timing.
  out.pillarDescent = heavy(t, 4.0, 5.35)

  // 06. ALONE. 1 through the held breath, so systems can damp themselves.
  out.stillness = pulse(t, 5.1, 5.55, 6.05)

  // The Blender clip is authored against the same clock, one second per
  // second, so this is the identity. It exists as a channel anyway: if the
  // machine's beats ever need to slip against the world's, this is the only
  // line that changes.
  out.portalTime = Math.min(DURATION, Math.max(0, t))

  // 09. The travelling circuit. The caller distributes this around the ring.
  out.ignition = span(t, 8.0, 9.05)
  out.power = span(t, 8.9, 9.8)

  // 10. Exactly one shockwave, leaving at full power.
  out.shockwave = t < 9.15 ? 0 : Math.min(1, (t - 9.15) / 1.0)

  // 11-12. Daylight collapses, then night settles. Deliberately overlapping:
  // warmth leaves before darkness arrives, which is what stops the change
  // reading as a cross-fade between two photographs.
  out.twilight = span(t, 9.9, 11.1)
  out.night = span(t, 10.2, 11.85)

  // 12-15. Step 5 owns the camera; these are the channels it will read.
  out.approach = span(t, 11.9, 13.0)
  out.through = span(t, 12.9, 14.0)
  out.blackout = pulse(t, 13.7, 14.25, 14.75)
  out.destination = span(t, 14.5, 15.0)

  return out
}
