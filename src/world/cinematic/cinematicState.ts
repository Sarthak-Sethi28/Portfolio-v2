'use client'

/**
 * The master clock lives outside React so every visual system can sample the
 * exact same position without re-rendering the world every frame.
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

/** True while a dedicated portal flight rig owns the camera. */
export const portalTransitionActive = { value: false }

/** Continuous day/night blend published for render-only consumers. */
export const worldNight = { value: 0 }

/** +1 = day -> night, -1 = night -> day. */
export const cinematicDirection = { value: 1 as 1 | -1 }

/**
 * Night -> day is NOT the forward movie played backwards anymore.
 *
 * The previous pass literally rewound the exterior timeline after the tunnel:
 * the camera retreated from the portal, pillars rose backwards and every water
 * beat visibly un-happened. The recording made that feel like scrubbing a
 * video in reverse. The return now has its own short forward portal approach;
 * while the Blender tunnel covers the frame we silently restore the DAY state.
 */
export const returnJourney = {
  active: false,
  /** Real-time seconds since F was pressed on the night destination. */
  elapsed: 0,
}

export const cinematicClock = {
  /** Forward authored timeline position in seconds. */
  elapsed: 0,
  /** Frozen position from ?seq=, or null to let it run. */
  scrub: null as number | null,
  /** True only while the authored DAY -> NIGHT timeline is advancing. */
  running: false,
}

/** The shared sample. Written once per frame by the director, read by all. */
export const cinematicSample: CinematicSample = createSample()

/** Set the timeline absolutely and update every dependent envelope immediately. */
export function setCinematicTime(t: number): void {
  cinematicClock.elapsed = Math.max(0, Math.min(DURATION, t))
  sampleCinematic(cinematicClock.elapsed, cinematicSample)
}

/** Advance and re-sample. Called from exactly one place. */
export function advanceCinematic(delta: number): void {
  if (cinematicClock.scrub !== null) {
    setCinematicTime(cinematicClock.scrub)
    return
  }

  if (cinematicClock.running) {
    // The authored exterior sequence only runs forward. Return travel is a
    // separate portal/tunnel journey, not a negative-speed version of this.
    setCinematicTime(cinematicClock.elapsed + delta)
    return
  }

  sampleCinematic(cinematicClock.elapsed, cinematicSample)
}

export function resetCinematic(): void {
  cinematicDirection.value = 1
  returnJourney.active = false
  returnJourney.elapsed = 0
  cinematicClock.running = false
  setCinematicTime(0)
}

export { DURATION }
