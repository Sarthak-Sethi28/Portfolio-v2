import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
} from 'three'
import { createRng } from '@/lib/rng'

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
  const waves = Array.from({ length: 9 }, (_, i) => {
    const long = i < 4
    return {
      angle: rng() * Math.PI * 2,
      freq: long ? 1 + rng() * 2 : 4 + rng() * 7,
      phase: rng() * Math.PI * 2,
      amp: long ? 0.55 + rng() * 0.45 : 0.1 + rng() * 0.16,
    }
  })

  const heightAt = (u: number, v: number) => {
    let h = 0
    for (const w of waves) {
      const k =
        Math.cos(w.angle) * u * Math.PI * 2 * w.freq +
        Math.sin(w.angle) * v * Math.PI * 2 * w.freq
      h += Math.sin(k + w.phase) * w.amp
    }
    return h
  }

  // Central differences give normals that match the height field exactly.
  const e = 1 / SIZE
  const strength = 0.055

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
