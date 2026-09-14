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
  /** Local water agitation around the portal. */
  disturbance: number
  /** Birds break formation and flee. */
  scatter: number
  /** The ocean draws inward. */
  pull: number
  /** Columns sink. 1 is fully submerged. */
  pillarDescent: number
  /** Time to drive the Blender mixer with, in seconds. */
  portalTime: number
  /** How far the ignition has travelled the ring, 0..1. */
  ignition: number
  /** Steady-state power once lit. */
  power: number
  /** The single water shockwave. */
  shockwave: number
  /** Authoritative night level during the cinematic. */
  night: number
  /** The near-black interstitial. */
  blackout: number
}

/** A single shared sample object, mutated in place. */
export function createSample(): CinematicSample {
  return {
    disturbance: 0, scatter: 0, pull: 0, pillarDescent: 0,
    portalTime: 0, ignition: 0, power: 0, shockwave: 0,
    night: 0, blackout: 0,
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
  // 02-04. Local water only. The whole ocean must not change speed.
  out.disturbance = span(t, 1.15, 3.2) * (1 - span(t, 11.5, 13.5) * 0.55)
  out.pull = span(t, 3.0, 4.1)

  // 03. Birds flee. Gone from the composition by about 3.3.
  out.scatter = span(t, 2.0, 3.3)

  // 05. Columns descend, 4.0 to 5.0 with per-pillar stagger applied by the
  // caller — this is the envelope, not the individual timing.
  /*
   * The columns come back while the screen is black.
   *
   * They sink at four seconds and must be STANDING again at fifteen, because
   * the signed-off night endpoint has all four of them — the destination is a
   * contract, not a consequence of what the journey happened to leave behind.
   * Restoring them between 14.05 and 14.4 puts the change entirely inside the
   * blackout, where the camera is also being repositioned, so the world on the
   * far side is simply the world that was always there.
   */
  /*
   * A LONGER window, so four separate descents can overlap.
   *
   * The envelope ran 4.0-5.35 and every column was gone almost together,
   * which emptied the frame in an instant. Starts are staggered by the caller
   * from 3.80 to 4.40 and each takes about a second, so the last crown is
   * still going under while the first is already only foam.
   */
  out.pillarDescent = span(t, 3.8, 5.6) * (1 - span(t, 14.05, 14.4))

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

  /*
   * 11-12. Daylight collapses, then night settles.
   *
   * One channel, not two. A separate `twilight` value existed alongside this
   * and nothing ever read it: the warmth leaving the sky is already carried by
   * the palette blend this drives, so the second channel was describing the
   * same event twice and could only ever disagree with itself.
   */
  out.night = span(t, 10.2, 11.85)

  /*
   * 12-15. The camera's own path is authored as control points in
   * CinematicCamera rather than as channels here — `approach`, `through` and
   * `destination` were reserved for it and went unused, so they are gone. Only
   * the blackout is shared, because the veil and the hidden reposition both
   * have to agree on exactly when the screen is opaque.
   */
  out.blackout = pulse(t, 13.7, 14.25, 14.75)

  return out
}
