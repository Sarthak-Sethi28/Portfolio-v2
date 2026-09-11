import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from 'three'
import { createRng } from '@/lib/rng'

/**
 * A tiling concrete surface, generated once at module load.
 *
 * Flat-coloured boxes were the giveaway that these were primitives rather than
 * objects. Real concrete has three things at silhouette distance: fine
 * aggregate grain, long vertical weathering streaks where water has run down
 * the faces, and horizontal form-tie lines from the shuttering it was poured
 * against. All three are cheap to synthesise and all three survive being seen
 * mostly in shadow — they show up exactly where the rim light rakes an edge,
 * which is the only place these slabs are not pure black.
 *
 * Built as a single-channel DataTexture used for both roughness and bump, so
 * it costs one 512x512 byte array rather than a texture fetch.
 */

const SIZE = 512

function buildConcrete(): DataTexture {
  const rng = createRng(0x4f9c21)
  // RGBA, not single-channel: three reads roughnessMap from the GREEN channel
  // and metalnessMap from blue. A red-only texture makes roughness read as 0,
  // which turns every slab into a mirror covered in specular glitter.
  const data = new Uint8Array(SIZE * SIZE * 4)

  // Value-noise lattice, sampled bilinearly and summed over octaves.
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
      // Smoothstep the interpolant so cell edges do not show as a grid.
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

  const o1 = lattice(8)
  const o2 = lattice(19)
  const o3 = lattice(53)
  const o4 = lattice(127)
  // Streaks: a lattice sampled with the vertical axis heavily compressed, so
  // each cell smears into a long vertical run rather than a blob.
  const streak = lattice(37)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE
      const v = y / SIZE

      let n = o1(u, v) * 0.44 + o2(u, v) * 0.28 + o3(u, v) * 0.18 + o4(u, v) * 0.1

      // Vertical weathering. Only the darker half of the streak field is kept,
      // so runs read as occasional stains rather than corduroy.
      const s = streak(u, v * 0.045)
      n -= Math.max(0, s - 0.56) * 0.55

      // Form-tie lines from the shuttering, every eighth of the height.
      const band = Math.abs(((v * 8) % 1) - 0.5)
      if (band > 0.47) n -= 0.10

      // Remap into a narrow band near the top of the range.
      //
      // roughnessMap MULTIPLIES the material's roughness, so a texel near 0
      // drives roughness to 0 — a perfect mirror — and the key light blows a
      // specular hotspot across that patch. Concrete is never glossy, so the
      // map has no business below about 0.6 anyway.
      const banded = 0.62 + Math.max(0, Math.min(1, n)) * 0.38
      const v8 = Math.max(0, Math.min(255, Math.round(banded * 255)))
      const i = (y * SIZE + x) * 4
      data[i] = v8
      data[i + 1] = v8
      data[i + 2] = v8
      data[i + 3] = 255
    }
  }

  const tex = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  // Mipmaps are NOT optional here. Without them a tiled map seen at a glancing
  // angle — which is every tall slab — aliases into a moire that crawls across
  // the face on every camera movement. Anisotropy keeps it sharp at the angles
  // where trilinear alone would go mushy.
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

let cached: DataTexture | null = null

function base(): DataTexture {
  cached ??= buildConcrete()
  return cached
}

/**
 * A view of the shared surface with its own tiling.
 *
 * `repeat` lives on the texture, not the mesh, so a single shared instance
 * cannot tile differently per slab — every monolith would overwrite the last
 * one's value. Clones share the underlying image data and cost only a small
 * wrapper object each.
 */
export function concreteTiled(repeatX: number, repeatY: number): DataTexture {
  const tex = base().clone()
  tex.repeat.set(repeatX, repeatY)
  tex.needsUpdate = true
  return tex
}
