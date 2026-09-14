/**
 * THE ARRIVAL SEQUENCE.
 *
 * Sixteen beats, one normalised clock. Everything the sequence touches —
 * camera, water, columns, the portal's segments, the sky — reads its own value
 * out of the same `t`, so there is exactly one place that decides what moment
 * the world is in and no two systems can disagree about it.
 *
 * Written as data rather than as a chain of timeouts on purpose: a timeline
 * you can SCRUB is a timeline you can debug. `?seq=0.45` freezes the world
 * mid-unlock and holds it there, which is the only practical way to look at a
 * single frame of a fifteen-second move, and the only way to screenshot one.
 *
 * The last beat is deliberately empty. The boards ended on a composed "next
 * world" shot, and that shot already exists — it is the night scene. Arriving
 * somewhere the visitor has not seen before would make the whole journey feel
 * like a cutscene played at them; arriving in the place the site actually
 * lives makes it feel like they went there.
 */

export type Beat = {
  /** Where this beat starts on the 0..1 clock. */
  at: number
  name: string
  note: string
}

export const BEATS: Beat[] = [
  { at: 0.0, name: 'THE ARRIVAL', note: 'Calm. Ancient. Monumental.' },
  { at: 0.06, name: 'A CLOSER LOOK', note: 'Something feels different.' },
  { at: 0.12, name: 'THE DISTURBANCE', note: 'Birds scatter. The water stirs.' },
  { at: 0.18, name: 'THE PULL', note: 'The ocean draws in.' },
  { at: 0.26, name: 'THE RESPONSE', note: 'The pillars descend.' },
  { at: 0.34, name: 'ALONE', note: 'The structure remains.' },
  { at: 0.4, name: 'THE UNLOCK', note: 'Segments shift.' },
  { at: 0.5, name: 'LAYERS REVEAL', note: 'A deeper mechanism awakens.' },
  { at: 0.58, name: 'ENERGY IGNITION', note: 'The light travels.' },
  { at: 0.68, name: 'FULL POWER', note: 'The portal comes alive.' },
  { at: 0.76, name: 'THE SHIFT', note: 'Day turns to night.' },
  { at: 0.84, name: 'A NEW REALITY', note: 'The world changes.' },
  { at: 0.89, name: 'THE APPROACH', note: 'Drawn forward.' },
  { at: 0.93, name: 'THROUGH THE APERTURE', note: 'A moment between worlds.' },
  { at: 0.97, name: 'THE TRANSITION', note: 'Beyond.' },
  { at: 1.0, name: 'THE DESTINATION', note: 'Projects.' },
]

/** 0 before `a`, 1 after `b`, smoothly eased between. */
export function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** Rises to 1 at `peak` and falls back to 0 by `b` — for one-off events. */
export function pulse(t: number, a: number, peak: number, b: number): number {
  return t < peak ? span(t, a, peak) : 1 - span(t, peak, b)
}

/**
 * Everything the world needs to know, derived from one number.
 *
 * Deliberately a plain function of `t` with no state of its own: scrubbing
 * backwards has to produce exactly the frame that playing forwards did, and
 * anything that accumulates — a velocity, an eased-toward value — breaks that
 * the moment you seek.
 */
export function sample(t: number) {
  return {
    /*
     * FOUR CAMERA POSITIONS, not one.
     *
     * The first cut of this had a single push and then held at one distance
     * for every remaining beat, which meant the mechanical beats — the unlock,
     * the layers, the ignition — all played out as a small shape in the middle
     * of frame. The boards do not do that: they go TIGHT for the mechanism and
     * come back out for the reveal, and that alternation is most of why they
     * read as a sequence rather than as one long take of an object.
     *
     * wide -> medium on the ring -> tight on the mechanism -> back out for
     * full power -> through.
     */
    approach: span(t, 0.06, 0.3),
    /** In close for the unlock and the layers. */
    closeIn: span(t, 0.4, 0.55),
    /** Back out so the whole ring is in frame when it comes alive. */
    standBack: span(t, 0.66, 0.78),
    /** Birds break and scatter. */
    scatter: span(t, 0.12, 0.2),
    /** Surface agitation, then the draw inward. */
    unrest: span(t, 0.12, 0.26),
    pull: span(t, 0.18, 0.3),
    /** The columns sink. 1 means fully submerged. */
    descend: span(t, 0.26, 0.36),
    /** Segments separate and rotate. */
    unlock: span(t, 0.4, 0.52),
    /** The inner mechanism slides clear of the stone. */
    reveal: span(t, 0.5, 0.6),
    /** How far the ignition has travelled around the ring, 0..1. */
    ignition: span(t, 0.58, 0.7),
    /** Steady-state emissive once lit. */
    power: span(t, 0.66, 0.78),
    /** Storm, then the turn to night. */
    storm: pulse(t, 0.76, 0.82, 0.9),
    night: span(t, 0.78, 0.88),
    /** Camera travels into and through the bore. */
    approachGate: span(t, 0.89, 0.95),
    through: span(t, 0.93, 0.98),
    /** Full black at the cut, so the two worlds never have to match. */
    blackout: pulse(t, 0.95, 0.975, 1.0),
  }
}
