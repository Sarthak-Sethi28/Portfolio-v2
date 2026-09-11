import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  ClampToEdgeWrapping,
  UnsignedByteType,
} from 'three'
import { createRng } from '@/lib/rng'

/**
 * Board-formed concrete, generated once at module load.
 *
 * Flat-coloured boxes were the giveaway that these were primitives. Real cast
 * concrete carries four things that survive being seen almost entirely in
 * shadow, which is how these slabs are seen:
 *
 *  - TIMBER GRAIN. Board-formed concrete is poured against rough sawn planks
 *    and takes their impression: horizontal bands with wood grain running
 *    through them and a hard shadow line at every board joint. This is the
 *    single most recognisable thing about brutalist concrete.
 *  - WEATHERING STREAKS where rain has run down the faces.
 *  - WATERLINE STAINING. Anything standing in water darkens for the first
 *    metre or so, and the tide line is sharp.
 *  - AGGREGATE. Fine stone grain under all of it.
 *
 * The map tiles HORIZONTALLY ONLY. Tiling vertically would repeat the
 * waterline stain up the shaft, which is why the vertical axis is clamped.
 */

const W = 256
const H = 1024 // tall, because the vertical axis is a single unrepeated run

function buildConcrete(): DataTexture {
  const rng = createRng(0x4f9c21)
  const data = new Uint8Array(W * H * 4)

  const lattice = (cells: number) => {
    const g = new Float32Array((cells + 1) * (cells + 1))
    for (let i = 0; i < g.length; i++) g[i] = rng()
    return (x: number, y: number) => {
      const fx = x * cells
      const fy = y * cells
      const x0 = Math.floor(fx) % cells
      const y0 = Math.floor(fy) % cells
      const tx = fx - Math.floor(fx)
      const ty = fy - Math.floor(fy)
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const at = (cx: number, cy: number) => g[(cy % cells) * (cells + 1) + (cx % cells)]
      const a = at(x0, y0)
      const b = at(x0 + 1, y0)
      const c = at(x0, y0 + 1)
      const d = at(x0 + 1, y0 + 1)
      return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy
    }
  }

  const aggregate = lattice(97)
  const coarse = lattice(13)
  const grainField = lattice(211)
  const streak = lattice(29)

  // Board layout: planks of slightly varying width, as real shuttering is.
  const BOARDS = 22
  const boardEdges: number[] = [0]
  for (let i = 0; i < BOARDS; i++) {
    boardEdges.push(boardEdges[i] + (0.8 + rng() * 0.4))
  }
  const span = boardEdges[boardEdges.length - 1]
  for (let i = 0; i < boardEdges.length; i++) boardEdges[i] /= span

  const boardAt = (v: number) => {
    for (let i = 0; i < boardEdges.length - 1; i++) {
      if (v >= boardEdges[i] && v < boardEdges[i + 1]) {
        return { index: i, t: (v - boardEdges[i]) / (boardEdges[i + 1] - boardEdges[i]) }
      }
    }
    return { index: BOARDS - 1, t: 0.5 }
  }

  for (let y = 0; y < H; y++) {
    const v = y / H
    const { index, t } = boardAt(v)

    for (let x = 0; x < W; x++) {
      const u = x / W

      let n = coarse(u, v) * 0.30 + aggregate(u, v) * 0.22 + 0.48

      // Timber grain: long horizontal fibres, offset per board so adjacent
      // planks never share a pattern.
      const grain = grainField(u * 0.35 + index * 0.31, v * 9.0)
      n += (grain - 0.5) * 0.16

      // Board joints. A hard dark line at each edge with a soft lip, which is
      // what actually reads at distance.
      const edge = Math.min(t, 1 - t)
      n -= Math.max(0, 1 - edge * 14) * 0.30

      // Rain streaks running down the face.
      const s = streak(u, v * 0.06)
      n -= Math.max(0, s - 0.58) * 0.42

      // Waterline. Sharp tide mark, darkening below it, heaviest at the base.
      const fromBase = v // v = 0 is the bottom of the shaft
      if (fromBase < 0.13) {
        const depth = 1 - fromBase / 0.13
        n -= depth * depth * 0.34
        // The tide line itself, a touch darker still.
        if (Math.abs(fromBase - 0.13) < 0.006) n -= 0.12
      }

      // Remap into a narrow band near the top of the range.
      //
      // roughnessMap MULTIPLIES roughness, and roughness also selects which
      // blurred mip of the ENVIRONMENT map a pixel samples. Wide variation
      // means neighbouring pixels choose different mips and those choices flip
      // as the camera moves — specular aliasing. Concrete is never glossy, so
      // the interest has to come from a whisper of variation.
      const banded = 0.82 + Math.max(0, Math.min(1, n)) * 0.16

      const v8 = Math.max(0, Math.min(255, Math.round(banded * 255)))
      const i = (y * W + x) * 4
      data[i] = v8
      data[i + 1] = v8
      data[i + 2] = v8
      data[i + 3] = 255
    }
  }

  const tex = new DataTexture(data, W, H, RGBAFormat, UnsignedByteType)
  tex.wrapS = RepeatWrapping
  // Clamped: the waterline stain must occur once, at the bottom, not repeat.
  tex.wrapT = ClampToEdgeWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

let cached: DataTexture | null = null

function base(): DataTexture {
  cached ??= buildConcrete()
  return cached
}

/**
 * A view of the shared surface with its own horizontal tiling.
 *
 * repeat lives on the texture, not the mesh, so one shared instance cannot
 * tile differently per slab. Clones share the underlying image data.
 */
export function concreteTiled(repeatX: number, anisotropy = 8): DataTexture {
  const tex = base().clone()
  // Vertical repeat stays at 1 so the waterline happens once.
  tex.repeat.set(Math.max(1, Math.round(repeatX)), 1)
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}
