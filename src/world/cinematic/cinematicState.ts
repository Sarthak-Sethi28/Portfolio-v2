'use client'

/**
 * The master clock, deliberately OUTSIDE React.
 *
 * React owns only the coarse cinematic status. The continuous playhead lives in
 * this mutable object so every visual system can sample the exact same value
 * without forcing the entire scene tree to re-render every frame.
 */

import { Vector3 } from 'three'
import { createSample, sampleCinematic, DURATION, type CinematicSample } from './timeline'

/** Where the real portal aperture is, measured from the loaded GLB. */
export const portalFrame = {
  centre: new Vector3(0, 32, -150),
  /** Unit vector out of the aperture toward the viewer. */
  axis: new Vector3(0, 0, 1),
  /** Outer radius in world units. */
  radius: 42,
  /** How far the bore runs back from the aperture, world units. */
  depth: 84,
  measured: false,
}

/** Explicit camera ownership so IdleRig never fights the cinematic. */
export const cameraOwnedByCinematic = { value: false }

/** True while the authored Blender tunnel is the transit visual. */
export const blenderTunnelActive = { value: false }

/** True while the dedicated portal flight rig owns the camera. */
export const portalTransitionActive = { value: false }

/** Continuous day/night blend published for render-only consumers. */
export const worldNight = { value: 0 }

/**
 * Which way the journey is currently travelling.
 *
 * +1 = day -> night
 * -1 = night -> day
 *
 * Keeping direction beside the clock lets EVERY existing timeline envelope run
 * backward automatically: pillars rise, red power falls, whitewater settles and
 * the sky returns to day from the exact same authored values.
 */
export const cinematicDirection = { value: 1 as 1 | -1 }

export const cinematicClock = {
  /** Timeline position in seconds. */
  elapsed: 0,
  /** Frozen position from ?seq=, or null to let it run. */
  scrub: null as number | null,
  /** True while advancing in either direction. */
  running: false,
}

/** The shared sample. Written once per frame by the director, read by all. */
export const cinematicSample: CinematicSample = createSample()

/** Advance and re-sample. Called from exactly one place. */
export function advanceCinematic(delta: number): void {
  if (cinematicClock.scrub !== null) {
    cinematicClock.elapsed = cinematicClock.scrub
  } else if (cinematicClock.running) {
    cinematicClock.elapsed = Math.max(
      0,
      Math.min(DURATION, cinematicClock.elapsed + delta * cinematicDirection.value),
    )
  }
  sampleCinematic(cinematicClock.elapsed, cinematicSample)
}

export function resetCinematic(): void {
  cinematicDirection.value = 1
  cinematicClock.elapsed = 0
  cinematicClock.running = false
  sampleCinematic(0, cinematicSample)
}

export { DURATION }
