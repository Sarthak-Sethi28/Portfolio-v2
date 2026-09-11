import { Vector2 } from 'three'

/**
 * Profile curve for the parabolic reflector, for LatheGeometry.
 *
 * A real dish is y = r^2 / (4f). Getting the focal ratio right matters more
 * than it sounds: too shallow and it reads as a plate, too deep and it reads as
 * a bowl. f/D around 0.4 is what large radio telescopes actually use and what
 * the concept frames show.
 */
export function dishProfile(
  radius: number,
  focalRatio = 0.4,
  segments = 28,
  thickness = 0.16,
): Vector2[] {
  const f = focalRatio * radius * 2
  const pts: Vector2[] = []

  // Front (concave) face, centre outward.
  for (let i = 0; i <= segments; i++) {
    const r = (i / segments) * radius
    pts.push(new Vector2(r, (r * r) / (4 * f)))
  }
  // Rim lip.
  pts.push(new Vector2(radius, (radius * radius) / (4 * f) + thickness * 2))
  // Back face, outward inward, offset by the shell thickness.
  for (let i = segments; i >= 0; i--) {
    const r = (i / segments) * radius
    pts.push(new Vector2(r * 0.999, (r * r) / (4 * f) + thickness * 2 + thickness))
  }
  return pts
}

/** Radial positions for the lattice struts behind the dish. */
export function strutRing(
  count: number,
  radius: number,
): { angle: number; x: number; z: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    return { angle, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  })
}

/**
 * Positions of the red aircraft warning lights around the rim.
 *
 * Named rather than inlined because §5a drives these as the morse channel for
 * an outgoing transmission, so the contact feature needs the same ring.
 */
export function rimLights(count: number, radius: number, rise: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2
    return {
      index: i,
      position: [Math.cos(angle) * radius, rise, Math.sin(angle) * radius] as [
        number,
        number,
        number,
      ],
    }
  })
}
