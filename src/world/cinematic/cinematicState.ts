'use client'

/**
 * The master clock, deliberately OUTSIDE React.
 *
 * The previous system wrote the transition's progress into the store, rounded
 * to twenty steps to make that affordable. Both halves of that were wrong: a
 * store write is a render of every subscriber, so a continuous value cost a
 * re-render of the whole world tree sixty times a second, and quantising to
 * twenty steps to afford it meant the animation advanced in visible stairs.
 *
 * So the clock is a plain mutable object. React holds only the coarse state —
 * whether the thing is playing — which changes three times in fifteen seconds.
 * Every frame-rate-sensitive consumer reads this object directly inside its own
 * frame callback, where mutation is free and legal.
 */

import { Vector3 } from 'three'
import { createSample, sampleCinematic, DURATION, type CinematicSample } from './timeline'

/**
 * Where the portal actually is, measured from the loaded asset.
 *
 * Written once by PortalCinematic from the model's own bounding box and read
 * by the camera. The camera has to fly through the real aperture, and a centre
 * copied out of a screenshot would be right only until the portal is moved,
 * resized or re-exported — at which point the camera would thread thin air and
 * nothing would report an error.
 */
export const portalFrame = {
  centre: new Vector3(0, 32, -150),
  /** Unit vector out of the aperture toward the viewer. */
  axis: new Vector3(0, 0, 1),
  /** Outer radius in world units. */
  radius: 42,
  measured: false,
}

/**
 * Explicit camera ownership.
 *
 * Two controllers writing the same camera and hoping mount order settles it is
 * how a one-frame pop gets in and stays in. While this is true, IdleRig does
 * not touch the camera at all.
 */
export const cameraOwnedByCinematic = { value: false }

export const cinematicClock = {
  /** Seconds since the cinematic began. The single source of truth. */
  elapsed: 0,
  /** Frozen position from ?seq=, or null to let it run. */
  scrub: null as number | null,
  /** True while advancing. */
  running: false,
}

/** The shared sample. Written once per frame by the director, read by all. */
export const cinematicSample: CinematicSample = createSample()

/** Advance and re-sample. Called from exactly one place. */
export function advanceCinematic(delta: number): void {
  if (cinematicClock.scrub !== null) {
    cinematicClock.elapsed = cinematicClock.scrub
  } else if (cinematicClock.running) {
    cinematicClock.elapsed = Math.min(DURATION, cinematicClock.elapsed + delta)
  }
  sampleCinematic(cinematicClock.elapsed, cinematicSample)
}

export function resetCinematic(): void {
  cinematicClock.elapsed = 0
  cinematicClock.running = false
  sampleCinematic(0, cinematicSample)
}

export { DURATION }
