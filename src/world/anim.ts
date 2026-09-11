/**
 * Mutable per-frame animation state, shared between Stage and its children.
 *
 * A plain object rather than a ref, so subsystems can read it inside their own
 * frame loops without anyone touching `ref.current` during render — which the
 * React Compiler correctly rejects.
 */
export interface Anim {
  /** Day/night blend, 0 to 1. */
  night: number
  /** Aperture hold-to-enter charge, 0 to 1. */
  charge: number
  /** Contact transmission progress, 0 to 1. */
  transmit: number
}

export function createAnim(): Anim {
  return { night: 0, charge: 0, transmit: 0 }
}

/**
 * Passed between components as the ref object itself, never as its contents —
 * dereferencing `.current` happens only inside frame callbacks.
 */
export type AnimRef = { current: Anim }
