/**
 * THE CINEMATIC TIMELINE — one deterministic clock for the whole sequence.
 *
 * The important rule in this pass is CAUSALITY. The ocean reacts first, the
 * portal charges second, full charge releases one low red front across the
 * water, that front is what makes the columns yield, and only after the world
 * has settled does the camera enter the gateway. Nothing later explodes again.
 */

export const DURATION = 15

/** 0 before `a`, 1 after `b`, smoothstepped between. */
export function span(t: number, a: number, b: number): number {
  if (b <= a) return t >= b ? 1 : 0
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

/** Rises to 1 at `peak`, falls back to 0 by `b`. */
export function pulse(t: number, a: number, peak: number, b: number): number {
  return t < peak ? span(t, a, peak) : 1 - span(t, peak, b)
}

/** A weighty ease used by systems that want a slow start before committing. */
export function heavy(t: number, a: number, b: number): number {
  const x = span(t, a, b)
  return x * x * (3 - 2 * x)
}

export interface CinematicSample {
  /** Local water agitation around the portal. */
  disturbance: number
  /** Birds break formation and flee. */
  scatter: number
  /** The ocean draws inward toward the machine. */
  pull: number
  /** Columns sink. 1 is fully submerged. */
  pillarDescent: number
  /** Time available to Blender-driven portal animation. */
  portalTime: number
  /** How far the red circuit has travelled, 0..1. */
  ignition: number
  /** Steady-state portal power once the circuit closes. */
  power: number
  /** The ONE low red water-surface discharge, 0..1 radius. */
  shockwave: number
  /** Authoritative night level during the cinematic. */
  night: number
  /** Final safety veil used only for the hidden destination handback. */
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
   * 01-04 — THE WATER NOTICES FIRST.
   *
   * Only the local patch around the portal changes. It begins as a disturbance,
   * then the flow acquires an inward bias. This is the first hint that the
   * machine is doing something to the world rather than the world merely
   * changing weather.
   */
  out.disturbance = span(t, 1.15, 2.75) * (1 - span(t, 10.9, 11.7) * 0.7)
  out.pull = span(t, 2.65, 4.25)

  // Birds leave before the machine gets loud, so they do not clutter the hero beat.
  out.scatter = span(t, 2.0, 3.3)

  /*
   * 07-09 — THE MACHINE CHARGES.
   *
   * The red circuit completes BEFORE anything major is discharged into the
   * environment. That ordering is the visual logic of the whole sequence.
   */
  out.ignition = span(t, 6.95, 8.20)
  out.power = span(t, 8.20, 8.65)

  /*
   * ONE discharge only.
   *
   * It starts exactly when full power is reached and travels across the water.
   * WaterShockwave renders this as a thin, low pressure/energy front — never a
   * sphere, fireball or screen flash.
   */
  out.shockwave = t < 8.65 ? 0 : Math.min(1, (t - 8.65) / 1.15)

  /*
   * 09-11 — THE WAVE MAKES THE COLUMNS YIELD.
   *
   * The per-column stagger is applied by ArrayWorld/ModelPier. The envelope is
   * deliberately the same 1.8 seconds the existing stagger was authored for,
   * so each pillar begins roughly two tenths after the previous one. They are
   * restored only under the final black transition for the signed-off Projects
   * endpoint.
   */
  out.pillarDescent = span(t, 8.95, 10.75) * (1 - span(t, 14.34, 14.52))

  // The mechanical clip can still use absolute cinematic time if needed.
  out.portalTime = Math.min(DURATION, Math.max(0, t))

  /*
   * Night arrives WITH the consequences of the discharge, not before it. The
   * last pillar is still going under as the warm world collapses into blue-black.
   */
  out.night = span(t, 9.35, 11.45)

  /*
   * The black/red Frame-15 look is rendered by PortalTransitionOverlay. This
   * veil exists only to make the hidden camera handback completely safe near
   * 14.5 seconds, then it clears into Projects by 15.0.
   */
  out.blackout = pulse(t, 14.28, 14.48, 15.0)

  return out
}
