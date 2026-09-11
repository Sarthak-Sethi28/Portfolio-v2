import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three'
import { createRng, range } from '@/lib/rng'

/**
 * A tiling water surface, as a true NORMAL map.
 *
 * The previous version encoded a flat 2D offset, which only smeared the
 * reflection sideways. That is not what water looks like: a real surface has
 * SLOPE, and slope is what catches a highlight on the near side of every wave
 * and darkens the far side. Without normals the plain can only ever be a
 * wobbling mirror — it can never glint.
 *
 * Built by summing directional waves and differentiating the height field, so
 * the normals are actually consistent with a surface rather than invented.
 * Kept low-frequency and low-amplitude: this is a centimetre of standing water
 * on a salt flat, not open sea, and high-frequency content here would alias
 * exactly as the earlier shimmer did.
 */

const SIZE = 512

function buildNormals(): DataTexture {
  const rng = createRng(0x1c7e93)
  const data = new Uint8Array(SIZE * SIZE * 4)

  // A few long crossing swells plus finer ripples riding on them.
  // Swell, not ripple. A few long low-frequency trains carrying most of the
  // amplitude, with finer chop riding on them — which is what a shallow sheet
  // of water on a flat bed actually does, and what makes crests legible
  // rather than a uniform fizz.
  /*
   * Frequencies must be WHOLE NUMBERS, and directions must land on the
   * lattice.
   *
   * The texture tiles. A wave whose frequency is fractional does not complete
   * a whole number of cycles across the tile, so its value at the right edge
   * does not match the left — and every tile boundary shows as a hard line.
   * At 70 repeats across the plain that was a visible grid drawn over the
   * water.
   *
   * Picking integer wave vectors (kx, ky) instead of an arbitrary angle keeps
   * every component periodic over the tile in both axes, so the field is
   * genuinely seamless.
   */
  const intVec = (min: number, max: number) => {
    let kx = 0
    let ky = 0
    // Reject (0,0), which is a constant and contributes no slope.
    while (kx === 0 && ky === 0) {
      kx = Math.round(range(rng, -max, max))
      ky = Math.round(range(rng, -max, max))
      if (Math.hypot(kx, ky) < min) {
        kx = 0
        ky = 0
      }
    }
    return { kx, ky }
  }

  const waves = Array.from({ length: 11 }, (_, i) => {
    const swell = i < 5
    const { kx, ky } = swell ? intVec(1, 2) : intVec(3, 8)
    return {
      kx,
      ky,
      phase: rng() * Math.PI * 2,
      amp: swell ? 1.0 + rng() * 0.8 : 0.12 + rng() * 0.2,
    }
  })

  const heightAt = (u: number, v: number) => {
    let h = 0
    for (const w of waves) {
      const k = (w.kx * u + w.ky * v) * Math.PI * 2
      h += Math.sin(k + w.phase) * w.amp
    }
    return h
  }

  // Central differences give normals that match the height field exactly.
  const e = 1 / SIZE
  const strength = 0.085

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE
      const v = y / SIZE

      const dx = (heightAt(u + e, v) - heightAt(u - e, v)) / (2 * e)
      const dy = (heightAt(u, v + e) - heightAt(u, v - e)) / (2 * e)

      let nx = -dx * strength
      let ny = -dy * strength
      const nz = 1
      const len = Math.hypot(nx, ny, nz)
      nx /= len
      ny /= len
      const nzn = nz / len

      const i = (y * SIZE + x) * 4
      data[i] = Math.round((nx * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round((nzn * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }

  const tex = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType)
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

let cached: DataTexture | null = null

function base(): DataTexture {
  cached ??= buildNormals()
  return cached
}

/**
 * Water is never one wave train.
 *
 * Two copies of the same field at different scales, drifting in different
 * directions, are what stop a surface reading as a scrolling texture — the
 * interference between them never repeats.
 */
export function waterNormals(repeat: number, anisotropy = 8): DataTexture {
  const tex = base().clone()
  tex.repeat.set(repeat, repeat)
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}
