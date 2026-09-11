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
