import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three'
import { createRng } from '@/lib/rng'

/**
 * A tiling distortion field for the water surface.
 *
 * A perfect mirror does not read as water — it reads as polished stone, which
 * is exactly the complaint. Real standing water has a slow-moving surface, and
 * what sells it is not big waves (this is a centimetre deep) but a very low
 * amplitude, long-wavelength disturbance that makes the reflection breathe
 * and wander instead of sitting frozen.
 *
 * Encoded as a two-channel offset in R and G, sampled by MeshReflectorMaterial
 * as a distortion map. Deliberately smooth: any high-frequency content here
 * would alias into the shimmer we just spent so long removing.
 */

const SIZE = 256

function buildRipples(): DataTexture {
  const rng = createRng(0x1c7e93)
  const data = new Uint8Array(SIZE * SIZE * 4)

  // Sum of a handful of directional sine waves at irrational frequency ratios,
  // so the pattern never visibly repeats within a tile.
  const waves = Array.from({ length: 6 }, () => ({
    angle: rng() * Math.PI * 2,
    freq: 1 + rng() * 3.2,
    phase: rng() * Math.PI * 2,
    amp: 0.35 + rng() * 0.65,
  }))

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = (x / SIZE) * Math.PI * 2
      const v = (y / SIZE) * Math.PI * 2

      let dx = 0
      let dy = 0
      for (const w of waves) {
        const k = Math.cos(w.angle) * u * w.freq + Math.sin(w.angle) * v * w.freq
        const s = Math.sin(k + w.phase) * w.amp
        dx += Math.cos(w.angle) * s
        dy += Math.sin(w.angle) * s
      }

      const i = (y * SIZE + x) * 4
      // Remapped into 0-255 around a neutral 128, the no-offset value.
      data[i] = Math.max(0, Math.min(255, Math.round(128 + dx * 42)))
      data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + dy * 42)))
      data[i + 2] = 128
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

export function rippleTexture(): DataTexture {
  cached ??= buildRipples()
  return cached
}
