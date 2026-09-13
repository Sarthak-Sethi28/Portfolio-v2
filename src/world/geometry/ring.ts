import {
  Euler,
  ExtrudeGeometry,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  Shape,
  Vector3,
  type BufferGeometry,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Modular primitives for the portal ring.
 *
 * The ring is an engineered machine, so it is built the way a machine is: a
 * small set of parts, made once, placed many times, and MERGED. Everything
 * here returns a geometry in its own local space; the caller transforms and
 * merges it, which is what keeps a hundred structural elements down to a
 * handful of draw calls.
 *
 * Every part is a real solid with a real chamfer. The depth in this object has
 * to come from concentric layers and recessed channels catching their own
 * shadow — not from a torus with detail stuck on the front of it, which is
 * exactly what reads as a prop rather than as engineering.
 */

/** One armour plate: an annular sector with chamfered arrises. */
export function arcPlate(
  innerR: number,
  outerR: number,
  start: number,
  sweep: number,
  depth: number,
  chamfer = 0.05,
  segments = 12,
): ExtrudeGeometry {
  const shape = new Shape()
  shape.absarc(0, 0, outerR, start, start + sweep, false)
  for (let i = segments; i >= 0; i--) {
    const a = start + (sweep * i) / segments
    shape.lineTo(Math.cos(a) * innerR, Math.sin(a) * innerR)
  }
  shape.closePath()

  const geo = new ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: chamfer > 0,
    bevelThickness: depth * chamfer,
    bevelSize: depth * chamfer,
    bevelSegments: 1,
    curveSegments: segments,
  })
  geo.translate(0, 0, -depth / 2)
  return geo
}

/**
 * A block with its corners cut.
 *
 * A plain box has four hard arrises that vanish the moment the light is not
 * in front of them. Cutting the corners gives every edge a narrow facet that
 * picks up a highlight from almost any direction, which is the single cheapest
 * thing that makes machined metal read as machined.
 */
export function chamferBox(w: number, h: number, d: number, chamfer: number): ExtrudeGeometry {
  const x = w / 2
  const y = h / 2
  const c = Math.min(chamfer, x * 0.9, y * 0.9)
  const s = new Shape()
  s.moveTo(-x + c, -y)
  s.lineTo(x - c, -y)
  s.lineTo(x, -y + c)
  s.lineTo(x, y - c)
  s.lineTo(x - c, y)
  s.lineTo(-x + c, y)
  s.lineTo(-x, y - c)
  s.lineTo(-x, -y + c)
  s.closePath()

  const geo = new ExtrudeGeometry(s, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: c * 0.5,
    bevelSize: c * 0.5,
    bevelSegments: 1,
    curveSegments: 1,
  })
  geo.translate(0, 0, -d / 2)
  return geo
}

/**
 * A buttress foot: a trapezoid, wide at the base, extruded.
 *
 * The ring has to look like it weighs something. A mass that widens as it
 * meets the water is the oldest way of saying "this is carrying a load", and
 * it is the reason the reference reads as installed rather than floating.
 */
export function wedge(
  topW: number,
  botW: number,
  height: number,
  depth: number,
  chamfer: number,
): ExtrudeGeometry {
  const s = new Shape()
  s.moveTo(-botW / 2, 0)
  s.lineTo(botW / 2, 0)
  s.lineTo(topW / 2, height)
  s.lineTo(-topW / 2, height)
  s.closePath()

  const geo = new ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: chamfer,
    bevelSize: chamfer,
    bevelSegments: 1,
    curveSegments: 1,
  })
  geo.translate(0, 0, -depth / 2)
  return geo
}

const SCRATCH = new Vector3(1, 1, 1)

/** Clone a part and put it somewhere. The caller keeps the original to reuse. */
export function placed(
  geo: BufferGeometry,
  position: Vector3,
  rotZ = 0,
  rotY = 0,
): BufferGeometry {
  const m = new Matrix4().compose(
    position,
    new Quaternion().setFromEuler(new Euler(0, rotY, rotZ)),
    SCRATCH,
  )
  return geo.clone().applyMatrix4(m)
}

/** Collapse many placed parts into one buffer, so they cost one draw call. */
export function merge(list: BufferGeometry[]): BufferGeometry {
  return mergeGeometries(list, false)
}

/**
 * A mound of rubble.
 *
 * The reference sets the ring in broken rock rather than on a cast plinth,
 * and it matters more than it sounds: a clean trapezoid foot says the object
 * was installed by someone with a crane, while a pile of fractured stone says
 * the thing has been here long enough for the ground to fail around it. Faceted
 * low-poly lumps at varied scales and rotations, merged to a single buffer.
 */
export function rubble(
  count: number,
  spread: number,
  height: number,
  size: number,
  rand: () => number,
): BufferGeometry {
  const parts: BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const t = i / count
    // Big at the base, tapering upward — a heap settles that way.
    const s = size * (1.15 - t * 0.55) * (0.6 + rand() * 0.8)
    const g = new IcosahedronGeometry(s, 0)
    g.scale(1 + rand() * 0.7, 0.55 + rand() * 0.5, 1 + rand() * 0.6)
    const m = new Matrix4().compose(
      new Vector3(
        (rand() - 0.5) * spread * (1 - t * 0.45),
        t * height + (rand() - 0.5) * size * 0.4,
        (rand() - 0.5) * spread * 0.7,
      ),
      new Quaternion().setFromEuler(
        new Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
      ),
      new Vector3(1, 1, 1),
    )
    parts.push(g.applyMatrix4(m))
  }
  return mergeGeometries(parts, false)
}
