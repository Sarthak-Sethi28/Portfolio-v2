import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three'
import { createRng } from '@/lib/rng'

/**
 * Procedural board-formed concrete PBR set.
 *
 * The previous material generated a decent concrete pattern but fed it only to
 * roughness. At screen size that still looked like a flat coloured box because
 * there was no colour variation and no normal relief for grazing light to
 * describe. This version derives three synchronized maps from one height field:
 *
 *   albedo    - board tone, rain streaks, tide staining and aggregate
 *   roughness - deliberately narrow/high to avoid specular shimmer
 *   normal    - shallow formwork/aggregate relief that survives at distance
 *
 * All maps are mipmapped and anisotropic. Detail is intentionally broad enough
 * to remain temporally stable while the camera moves.
 */

const W = 384
const H = 1536

export interface ConcreteMaps {
  albedo: DataTexture
  roughness: DataTexture
  normal: DataTexture
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function configure(tex: DataTexture, srgb = false): DataTexture {
  tex.wrapS = RepeatWrapping
  tex.wrapT = ClampToEdgeWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  if (srgb) tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function buildConcrete(): ConcreteMaps {
  const rng = createRng(0x4f9c21)
  const albedo = new Uint8Array(W * H * 4)
  const roughness = new Uint8Array(W * H * 4)
  const normal = new Uint8Array(W * H * 4)
  const heightField = new Float32Array(W * H)
  const toneField = new Float32Array(W * H)

  const lattice = (cells: number) => {
    const g = new Float32Array((cells + 1) * (cells + 1))
    for (let i = 0; i < g.length; i++) g[i] = rng()

    return (x: number, y: number) => {
      const fx = x * cells
      const fy = y * cells
      const bx = Math.floor(fx)
      const by = Math.floor(fy)
      const x0 = ((bx % cells) + cells) % cells
      const y0 = ((by % cells) + cells) % cells
      const tx = fx - bx
      const ty = fy - by
      const sx = tx * tx * (3 - 2 * tx)
      const sy = ty * ty * (3 - 2 * ty)
      const at = (cx: number, cy: number) =>
        g[((cy % cells) + cells) % cells * (cells + 1) + (((cx % cells) + cells) % cells)]
      const a = at(x0, y0)
      const b = at(x0 + 1, y0)
      const c = at(x0, y0 + 1)
      const d = at(x0 + 1, y0 + 1)
      return a * (1 - sx) * (1 - sy) + b * sx * (1 - sy) + c * (1 - sx) * sy + d * sx * sy
    }
  }

  const aggregate = lattice(83)
  const coarse = lattice(11)
  const grainField = lattice(157)
  const streak = lattice(23)

  const BOARDS = 24
  const boardEdges: number[] = [0]
  for (let i = 0; i < BOARDS; i++) boardEdges.push(boardEdges[i] + 0.8 + rng() * 0.4)
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

  // First pass: one broad height/tone field shared by every PBR channel.
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1)
    const { index, t } = boardAt(v)

    for (let x = 0; x < W; x++) {
      const u = x / (W - 1)
      const i = y * W + x

      const agg = aggregate(u, v)
      const broad = coarse(u, v)
      const grain = grainField(u * 0.34 + index * 0.27, v * 8.5)
      const rain = streak(u, v * 0.075)
      const edge = Math.min(t, 1 - t)
      const joint = Math.max(0, 1 - edge * 18)

      let h = 0.5
      h += (broad - 0.5) * 0.16
      h += (agg - 0.5) * 0.11
      h += (grain - 0.5) * 0.12
      h -= joint * 0.24

      let tone = 0.54
      tone += (broad - 0.5) * 0.13
      tone += (grain - 0.5) * 0.08
      tone += (agg - 0.5) * 0.055
      tone -= joint * 0.12
      tone -= Math.max(0, rain - 0.57) * 0.22

      // One damp tide line at the bottom, never vertically tiled.
      if (v < 0.14) {
        const wet = 1 - v / 0.14
        tone -= wet * wet * 0.2
        h -= wet * wet * 0.035
      }
      if (Math.abs(v - 0.14) < 0.0045) tone -= 0.09

      heightField[i] = clamp01(h)
      toneField[i] = clamp01(tone)
    }
  }

  // Second pass: albedo + deliberately narrow roughness.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      const i = p * 4
      const tone = toneField[p]
      const h = heightField[p]

      // Neutral grey texture multiplied by the material colour. Variation is
      // visible, but never so contrasty that it turns into crawling noise.
      const base = Math.round(184 + tone * 48)
      albedo[i] = Math.max(0, Math.min(255, base - 4))
      albedo[i + 1] = Math.max(0, Math.min(255, base))
      albedo[i + 2] = Math.max(0, Math.min(255, base - 2))
      albedo[i + 3] = 255

      const r = Math.round(218 + (1 - h) * 27)
      roughness[i] = r
      roughness[i + 1] = r
      roughness[i + 2] = r
      roughness[i + 3] = 255
    }
  }

  // Third pass: finite-difference normal map. Clamped vertically so the single
  // tide line does not wrap from the base to the top of the slab.
  const sample = (x: number, y: number) => {
    const xx = (x + W) % W
    const yy = Math.max(0, Math.min(H - 1, y))
    return heightField[yy * W + xx]
  }
  const strength = 3.1

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (sample(x + 1, y) - sample(x - 1, y)) * strength
      const dy = (sample(x, y + 1) - sample(x, y - 1)) * strength
      let nx = -dx
      let ny = -dy
      let nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv
      ny *= inv
      nz *= inv

      const i = (y * W + x) * 4
      normal[i] = Math.round((nx * 0.5 + 0.5) * 255)
      normal[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      normal[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      normal[i + 3] = 255
    }
  }

  return {
    albedo: configure(new DataTexture(albedo, W, H, RGBAFormat, UnsignedByteType), true),
    roughness: configure(new DataTexture(roughness, W, H, RGBAFormat, UnsignedByteType)),
    normal: configure(new DataTexture(normal, W, H, RGBAFormat, UnsignedByteType)),
  }
}

let cached: ConcreteMaps | null = null

function base(): ConcreteMaps {
  cached ??= buildConcrete()
  return cached
}

function tiled(source: DataTexture, repeatX: number, anisotropy: number): DataTexture {
  const tex = source.clone()
  tex.repeat.set(Math.max(1, repeatX), 1)
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}

export function concreteMapsTiled(repeatX: number, anisotropy = 8): ConcreteMaps {
  const maps = base()
  const repeat = Math.max(1, repeatX)
  return {
    albedo: tiled(maps.albedo, repeat, anisotropy),
    roughness: tiled(maps.roughness, repeat, anisotropy),
    normal: tiled(maps.normal, repeat, anisotropy),
  }
}
