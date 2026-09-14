/**
 * Where each column currently cuts the water.
 *
 * Published by the columns every frame and read by the displacement field, so
 * the foam and the pressure ring follow the actual intersection as the
 * structure goes down rather than sitting at a fixed point and hoping. A plain
 * Map outside React for the same reason everything else continuous is: it
 * changes sixty times a second and nothing about it should cause a render.
 *
 * Keyed by world position, so the mirrored copy of the world writes the same
 * entries as the real one rather than fighting it for a slot.
 */
export interface Waterline {
  x: number
  z: number
  /** 0 standing, 1 fully submerged. */
  depth: number
  height: number
}

export const waterline = new Map<string, Waterline>()
