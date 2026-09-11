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
 * Low-frequency water surface data shared by both reflection distortion and
 * the physical highlight layer. Keeping both maps analytic and mipmapped gives
 * the water shape without introducing the high-frequency sparkle that caused
 * motion shimmer in earlier passes.
 */

const SIZE = 384

interface Wave {
  angle: number
  freq: number
  phase: number
  amp: number
}

function makeWaves(): Wave[] {
  const rng = createRng(0x1c7e93)
  return Array.from({ length: 7 }, () => ({
    angle: rng() * Math.PI * 2,
    freq: 0.7 + rng() * 2.4,
    phase: rng() * Math.PI * 2,
    amp: 0.22 + rng() * 0.52,
  }))
}

const waves = makeWaves()

function heightAt(u: number, v: number): number {
  let h = 0
  for (const w of waves) {
    const ca = Math.cos(w.angle)
    const sa = Math.sin(w.angle)
    const k = ca * u * w.freq + sa * v * w.freq
    h += Math.sin(k + w.phase) * w.amp
  }
  return h
}

function configure(tex: DataTexture): DataTexture {
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

function buildDistortion(): DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4)

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * Math.PI * 2
      const v = (y / SIZE) * Math.PI * 2
      let dx = 0
      let dy = 0

      for (const w of waves) {
        const ca = Math.cos(w.angle)
        const sa = Math.sin(w.angle)
        const k = ca * u * w.freq + sa * v * w.freq
        const s = Math.sin(k + w.phase) * w.amp
        dx += ca * s
        dy += sa * s
      }

      const i = (y * SIZE + x) * 4
      data[i] = Math.max(0, Math.min(255, Math.round(128 + dx * 34)))
      data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 34)))
      data[i + 2] = 128
      data[i + 3] = 255
    }
  }

  return configure(new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType))
}

/**
 * Tangent-space normal map generated from the same long waves as the
 * distortion field. It produces broad moving highlights like real shallow
 * water instead of a perfectly flat mirror.
 */
function buildNormal(): DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 4)
  const eps = (Math.PI * 2) / SIZE
  const strength = 0.72

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * Math.PI * 2
      const v = (y / SIZE) * Math.PI * 2

      const dx = (heightAt(u + eps, v) - heightAt(u - eps, v)) * strength
      const dy = (heightAt(u, v + eps) - heightAt(u, v - eps)) * strength

      let nx = -dx
      let ny = -dy
      let nz = 1
      const inv = 1 / Math.hypot(nx, ny, nz)
      nx *= inv
      ny *= inv
      nz *= inv

      const i = (y * SIZE + x) * 4
      data[i] = Math.round((nx * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }

  return configure(new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType))
}

let distortionCache: DataTexture | null = null
let normalCache: DataTexture | null = null

export function rippleTexture(): DataTexture {
  distortionCache ??= buildDistortion()
  return distortionCache
}

export function waterNormalTexture(): DataTexture {
  normalCache ??= buildNormal()
  return normalCache
}
