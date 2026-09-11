import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'node:fs'

/**
 * Turn a photographic water surface into a tangent-space normal map.
 *
 * A photograph of water carries the one thing a sum of sine waves cannot:
 * irregularity. Real ripples vary in length, cross at inconsistent angles and
 * never repeat, and the eye reads that immediately — a procedural field always
 * betrays its period eventually.
 *
 * Luminance stands in for height, which is a lie in general but a good one for
 * a flat-lit surface photographed from directly above: the brighter pixels are
 * the crests catching the light. Sobel gives the gradient; the normal follows.
 *
 * The source does not tile, so the edges are cross-faded into their opposite
 * sides. That makes it genuinely seamless in both axes, which matters because
 * the previous field showed its tile boundaries as a grid drawn over the plain.
 */

const SRC = process.argv[2]
const OUT = process.argv[3]
const STRENGTH = Number(process.argv[4] ?? 2.6)
const BLEND = 0.14 // fraction of the image cross-faded at each edge

const src = PNG.sync.read(readFileSync(SRC))
const { width: W, height: H } = src

// --- height field from luminance -----------------------------------------
const h = new Float32Array(W * H)
for (let i = 0; i < W * H; i++) {
  const p = i * 4
  h[i] = (0.2126 * src.data[p] + 0.7152 * src.data[p + 1] + 0.0722 * src.data[p + 2]) / 255
}

// Normalise to use the full range: the source is low contrast by design.
let lo = Infinity
let hi = -Infinity
for (const v of h) {
  if (v < lo) lo = v
  if (v > hi) hi = v
}
const span = Math.max(1e-5, hi - lo)
for (let i = 0; i < h.length; i++) h[i] = (h[i] - lo) / span

// --- make it tile ---------------------------------------------------------
// Cross-fade each edge band with the band from the opposite side, weighted so
// the seam itself is a 50/50 blend and the interior is untouched.
const band = Math.floor(W * BLEND)
const tiled = Float32Array.from(h)
for (let y = 0; y < H; y++) {
  for (let x = 0; x < band; x++) {
    const t = 0.5 * (1 - Math.cos((x / band) * Math.PI)) // smootherstep-ish
    const a = h[y * W + x]
    const b = h[y * W + (W - band + x)]
    tiled[y * W + x] = b * (1 - t) + a * t
  }
}
const rowBand = Math.floor(H * BLEND)
const out = Float32Array.from(tiled)
for (let x = 0; x < W; x++) {
  for (let y = 0; y < rowBand; y++) {
    const t = 0.5 * (1 - Math.cos((y / rowBand) * Math.PI))
    const a = tiled[y * W + x]
    const b = tiled[(H - rowBand + y) * W + x]
    out[y * W + x] = b * (1 - t) + a * t
  }
}

// --- Sobel -> normals -----------------------------------------------------
const at = (x, y) => out[((y + H) % H) * W + ((x + W) % W)]

const png = new PNG({ width: W, height: H })
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const dx =
      at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
      (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1))
    const dy =
      at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
      (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1))

    let nx = dx * STRENGTH
    let ny = dy * STRENGTH
    const nz = 1
    const len = Math.hypot(nx, ny, nz)
    nx /= len
    ny /= len

    const i = (y * W + x) * 4
    png.data[i] = Math.round((nx * 0.5 + 0.5) * 255)
    png.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
    png.data[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255)
    png.data[i + 3] = 255
  }
}

writeFileSync(OUT, PNG.sync.write(png))
console.log(`wrote ${OUT} (${W}x${H}, strength ${STRENGTH})`)
