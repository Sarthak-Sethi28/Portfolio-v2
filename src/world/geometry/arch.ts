import { ExtrudeGeometry, Shape, Path } from 'three'

/**
 * A lancet — the tall pointed arch of the reference pillar.
 *
 * Built as a Shape so it can be extruded into a real plate with a real hole,
 * which is the entire point: the opening has to be an ACTUAL void with depth,
 * casting its own shadow, not a dark rectangle painted onto a face. That
 * depth is what the reference has and a textured box never will.
 *
 * The pointed head is struck as two arcs whose centres sit on the opposite
 * springing points — the real geometric construction of a lancet, which is
 * why it looks right rather than like a rounded rectangle.
 */
function lancetPath(w: number, h: number, headRatio = 0.42): Path {
  const p = new Path()
  const halfW = w / 2
  const springing = h * (1 - headRatio)

  p.moveTo(-halfW, 0)
  p.lineTo(-halfW, springing)
  // Left arc: centre at the RIGHT springing point, radius = full width.
  p.absarc(halfW, springing, w, Math.PI, Math.PI - Math.asin(h - springing > w ? 1 : (h - springing) / w), true)
  p.lineTo(0, h)
  // Right arc mirrors it.
  p.absarc(-halfW, springing, w, Math.asin(h - springing > w ? 1 : (h - springing) / w), 0, true)
  p.lineTo(halfW, springing)
  p.lineTo(halfW, 0)
  p.closePath()
  return p
}

/**
 * A rectangular plate with a lancet cut through it.
 *
 * `inset` shrinks the opening, so stacking two plates at different insets
 * produces the layered ORDERS of a real arch — each recessed step catching its
 * own line of shadow, which is most of what reads as carving at distance.
 */
export function archedPlate(
  panelW: number,
  panelH: number,
  openW: number,
  openH: number,
  thickness: number,
  sillHeight = 0,
): ExtrudeGeometry {
  const outline = new Shape()
  outline.moveTo(-panelW / 2, 0)
  outline.lineTo(panelW / 2, 0)
  outline.lineTo(panelW / 2, panelH)
  outline.lineTo(-panelW / 2, panelH)
  outline.closePath()

  const hole = lancetPath(openW, openH)
  // Lift the opening to sit on its sill.
  const lifted = new Path()
  const pts = hole.getPoints(48)
  lifted.moveTo(pts[0].x, pts[0].y + sillHeight)
  for (let i = 1; i < pts.length; i++) lifted.lineTo(pts[i].x, pts[i].y + sillHeight)
  lifted.closePath()
  outline.holes.push(lifted)

  const geo = new ExtrudeGeometry(outline, {
    depth: thickness,
    bevelEnabled: true,
    // A small bevel on the reveal catches the light the way a chamfered stone
    // arris does; without it the opening reads as cut from paper.
    bevelThickness: thickness * 0.16,
    bevelSize: thickness * 0.16,
    bevelSegments: 1,
    curveSegments: 10,
  })
  geo.translate(0, 0, -thickness / 2)
  return geo
}


/**
 * One voussoir: an annular sector, extruded.
 *
 * A straight box cannot be a wedge. Spanning twenty degrees of arc, its
 * corners protrude past the circle on both sides, and a ring of them reads as
 * a cog rather than as masonry — which is exactly what the first attempt
 * looked like. A real voussoir is bounded by two radii and two arcs, so that
 * is what this builds: the outer edge follows the circle exactly, and the only
 * gaps are the joints between one stone and the next.
 */
export function voussoir(
  innerR: number,
  outerR: number,
  startAngle: number,
  sweep: number,
  depth: number,
  segments = 6,
): ExtrudeGeometry {
  const shape = new Shape()

  shape.absarc(0, 0, outerR, startAngle, startAngle + sweep, false)
  // Close across to the inner arc and back, which makes the sector solid.
  const inner: [number, number][] = []
  for (let i = segments; i >= 0; i--) {
    const a = startAngle + (sweep * i) / segments
    inner.push([Math.cos(a) * innerR, Math.sin(a) * innerR])
  }
  inner.forEach(([x, y], i) => (i === 0 ? shape.lineTo(x, y) : shape.lineTo(x, y)))
  shape.closePath()

  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    // A chamfered arris catches the light the way a dressed stone edge does.
    bevelThickness: depth * 0.06,
    bevelSize: depth * 0.06,
    bevelSegments: 1,
    curveSegments: segments,
  })
  geo.translate(0, 0, -depth / 2)
  return geo
}
