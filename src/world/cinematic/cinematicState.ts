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

/*
 * RETURN BEAT SHEET, matched to the forward one.
 *
 * The return was previously a 1.28s dash that began on the very frame F was
 * pressed, against a forward flight of 3.71s that arrives after ten seconds of
 * exterior build. Same destination, a third of the time, and no beat in which
 * to register it — which is why it read as a snap rather than a journey.
 *
 * Forward, measured off PortalTransitionRig and BlenderTunnelTransition:
 *   T_START 10.75 -> T_HANDBACK 14.46   3.71s of flight into the ring
 *   video + aperture in at 11.55        0.80s after that flight begins
 *   aperture fade                       0.82s
 *
 * The return now holds on the night shot first, then flies for a comparable
 * stretch, and brings the tunnel in at the same 0.80s offset with the same
 * fade. These four numbers are the whole of the change; the flight path, the
 * easing shape and the tunnel itself are untouched.
 */
export const RETURN_HOLD = 0.85
export const RETURN_APPROACH = 3.55
export const RETURN_APERTURE_FADE = 0.82

/*
 * When the tunnel appears inside the ring.
 *
 * This cannot simply copy the forward offset. The moment the aperture grows to
 * cover the viewport is GEOMETRIC — it happens at roughly 95% of the approach
 * whatever that approach lasts — while the video is a fixed 3.00s. Starting the
 * clip 0.80s into a 3.55s approach, as the forward beat does inside its own
 * flight, left only 0.37s of full-frame tunnel before the file ran out.
 *
 * So the clip is instead started a fixed lead BEFORE the crossing, which is
 * what actually governs how the beat reads: the tunnel is visible through the
 * ring for that lead, then fills the frame for the remainder. Forward measures
 * 1.13s of tunnel-in-ring and 1.87s full-frame; these numbers reproduce it.
 */
const RETURN_CROSSING = RETURN_HOLD + RETURN_APPROACH * 0.95
export const RETURN_VIDEO_ON = RETURN_CROSSING - 1.15

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
/**
 * How much faster the DAY -> NIGHT journey runs than it was authored.
 *
 * The two directions were badly mismatched: night -> day takes about 6.2
 * seconds — a hold, a 3.55s approach, and roughly 1.8s of tunnel — while day ->
 * night ran the full fifteen-second authored timeline before the tunnel even
 * began. Going one way felt decisive and coming back felt like waiting.
 *
 * Scaling the CLOCK rather than rewriting the beat sheet keeps every envelope
 * in its authored proportion — the ocean still breaks before the ring lights,
 * the columns still go down in the same order — and it keeps the tunnel in
 * step for free: the aperture crossing is geometric, so a flight that takes
 * less time still crosses at the same fraction of itself, and the video still
 * starts the same distance before that crossing.
 *
 * 15 / 2.2 puts the forward journey at roughly 6.8 seconds, alongside the
 * return's 6.2.
 */
export const FORWARD_SPEED = 2.2

export function advanceCinematic(delta: number): void {
  if (cinematicClock.scrub !== null) {
    setCinematicTime(cinematicClock.scrub)
    return
  }

  if (cinematicClock.running) {
    // The authored exterior sequence only runs forward. Return travel is a
    // separate portal/tunnel journey, not a negative-speed version of this.
    setCinematicTime(cinematicClock.elapsed + delta * FORWARD_SPEED)
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
