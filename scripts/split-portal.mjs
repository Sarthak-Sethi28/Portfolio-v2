/**
 * Split the portal into movable segments.
 *
 * The asset exports as ONE welded mesh, which means nothing inside it can be
 * animated — and "THE UNLOCK: segments shift" is the hinge of the whole
 * sequence. Blender was the obvious answer and turned out not to be needed:
 * the mesh already contains 94 disconnected shells, so the parts are there,
 * they are simply not addressed separately.
 *
 * Walking the index buffer with union-find recovers them. Four of those shells
 * are large arcs whose centroids sit at 0, 90, 180 and 270 degrees around the
 * ring — the structural quadrants. The other ninety are fittings, plates and
 * feet, each assigned to whichever quadrant its own centroid is nearest, so a
 * bracket travels with the arc it is bolted to.
 *
 * Vertex attributes are SHARED between the four output primitives; only the
 * index buffers differ. Splitting the positions as well would have quadrupled
 * nothing useful and cost four times the upload.
 *
 * Pivots are deliberately left alone. Each segment keeps the model's own
 * origin, and the rotation centre is applied in the scene by nesting a group
 * at the ring's centre — baking pivots into the file would hard-code a centre
 * that a re-export could quietly move.
 */
import { NodeIO } from '@gltf-transform/core'

const SRC = process.argv[2]
const DST = process.argv[3]
/** Ring centre in the model's own space, measured from its bounding box. */
const CY = 0.9395

const io = new NodeIO()
const doc = await io.read(SRC)
const root = doc.getRoot()
const mesh = root.listMeshes()[0]
const prim = mesh.listPrimitives()[0]
const idx = prim.getIndices().getArray()
const P = prim.getAttribute('POSITION').getArray()
const n = prim.getAttribute('POSITION').getCount()

// --- recover the shells ---
const uf = new Int32Array(n)
for (let i = 0; i < n; i++) uf[i] = i
const find = (x) => { while (uf[x] !== x) { uf[x] = uf[uf[x]]; x = uf[x] } return x }
const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) uf[a] = b }
for (let i = 0; i < idx.length; i += 3) { uni(idx[i], idx[i + 1]); uni(idx[i + 1], idx[i + 2]) }

// --- centroid of each shell ---
const cent = new Map()
for (let i = 0; i < n; i++) {
  const r = find(i)
  let e = cent.get(r); if (!e) { e = { c: 0, x: 0, y: 0 }; cent.set(r, e) }
  e.c++; e.x += P[i * 3]; e.y += P[i * 3 + 1]
}

// --- assign every shell to the nearest quadrant centre ---
const NAMES = ['seg_right', 'seg_top', 'seg_left', 'seg_bottom']
const CENTRES = [0, 90, 180, 270]
const quadOf = new Map()
for (const [r, e] of cent) {
  const a = ((Math.atan2(e.y / e.c - CY, e.x / e.c) * 180) / Math.PI + 360) % 360
  let best = 0, bd = 1e9
  for (let q = 0; q < 4; q++) {
    // Angular distance the short way round, so 350 degrees is near 0.
    const d = Math.min(Math.abs(a - CENTRES[q]), 360 - Math.abs(a - CENTRES[q]))
    if (d < bd) { bd = d; best = q }
  }
  quadOf.set(r, best)
}

// --- rebuild one primitive per quadrant, sharing the vertex attributes ---
const buckets = [[], [], [], []]
for (let i = 0; i < idx.length; i += 3) {
  buckets[quadOf.get(find(idx[i]))].push(idx[i], idx[i + 1], idx[i + 2])
}

const scene = root.listScenes()[0]
for (const node of scene.listChildren()) node.dispose()

const buffer = root.listBuffers()[0]
for (let q = 0; q < 4; q++) {
  const tri = buckets[q]
  if (!tri.length) continue
  const indices = doc.createAccessor()
    .setArray(n > 65535 ? new Uint32Array(tri) : new Uint16Array(tri))
    .setType('SCALAR')
    .setBuffer(buffer)
  const p = doc.createPrimitive()
    .setIndices(indices)
    .setMaterial(prim.getMaterial())
  for (const name of prim.listSemantics()) p.setAttribute(name, prim.getAttribute(name))
  const m = doc.createMesh(NAMES[q]).addPrimitive(p)
  scene.addChild(doc.createNode(NAMES[q]).setMesh(m))
  console.log(`${NAMES[q]}: ${tri.length / 3} triangles`)
}

mesh.dispose()
await io.write(DST, doc)
console.log('wrote', DST)
