/**
 * THE CINEMATIC TIMELINE — one deterministic clock for the whole sequence.
 *
 * Nothing here is allowed to feel like: effect -> stop -> next effect. The
 * water rupture is still moving when the red circuit begins, the red charge is
 * still building when the surface discharge leaves, the wave is still crossing
 * the ocean when the pillars yield, and the camera is already advancing while
 * those consequences finish. One cause, one uninterrupted escalation.
 */

export const DURATION = 15

export function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

export function pulse(t: number, a: number, peak: number, b: number): number {
  return t < peak ? span(t, a, peak) : 1 - span(t, peak, b)
}

export function heavy(t: number, a: number, b: number): number {
  const x = span(t, a, b)
  return x * x * (3 - 2 * x)
}

export interface CinematicSample {
  disturbance: number
  scatter: number
  pull: number
  pillarDescent: number
  portalTime: number
  ignition: number
  power: number
  shockwave: number
  night: number
  blackout: number
}

export function createSample(): CinematicSample {
  return {
    disturbance: 0,
    scatter: 0,
    pull: 0,
    pillarDescent: 0,
    portalTime: 0,
    ignition: 0,
    power: 0,
    shockwave: 0,
    night: 0,
    blackout: 0,
  }
}

export function sampleCinematic(t: number, out: CinematicSample): CinematicSample {
  /*
   * 00.6 onward — THE OCEAN BREAKS FIRST.
   *
   * The disturbance never drops back to zero before the gateway takes over.
   * OceanRupture adds the visible cavity/pressure wall; this channel keeps the
   * existing water shading alive underneath it.
   */
  const waterRise = span(t, 0.60, 1.85)
  const waterRelease = 1 - span(t, 9.20, 11.55) * 0.72
  out.disturbance = waterRise * waterRelease
  out.pull = span(t, 1.35, 4.20)

  // The birds react during the same build, not as an isolated prelude.
  out.scatter = span(t, 1.15, 2.85)

  /*
   * 05-08 — RED GROWS INSIDE THE STORM.
   *
   * This intentionally overlaps the violent water instead of waiting for it to
   * finish. The machine is charging because of the same event we are already
   * watching, not starting a new scene.
   */
  out.ignition = span(t, 5.15, 7.15)
  out.power = span(t, 6.85, 7.65)

  /*
   * ONE low red front. It leaves while the charge is still visually climbing
   * and remains on the water while the first pillars begin to move.
   */
  out.shockwave = t < 7.45 ? 0 : Math.min(1, (t - 7.45) / 1.55)

  /*
   * 08-11 — THE WAVE TAKES THE PILLARS.
   * Per-column delay is still applied by ModelPier. The long envelope lets the
   * descents overlap; none of them waits for the previous one to finish.
   */
  out.pillarDescent = span(t, 8.00, 10.60) * (1 - span(t, 14.28, 14.50))

  out.portalTime = Math.min(DURATION, Math.max(0, t))

  // Night is already arriving while the pillars are in motion.
  out.night = span(t, 7.55, 10.95)

  /*
   * Final safety veil only. The authored red high-speed transition is rendered
   * by PortalTransitionOverlay; this black channel merely guarantees the hidden
   * destination handback cannot leak a frame.
   */
  out.blackout = pulse(t, 14.12, 14.46, 15.0)

  return out
}
