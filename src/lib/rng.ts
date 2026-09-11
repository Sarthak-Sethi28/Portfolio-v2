/**
 * Seeded pseudo-random number generation.
 *
 * The world places thousands of objects — debris, motes, height variance on the
 * array — and it must place them in the SAME position on every run. Without
 * that, visual regression screenshots compare two different worlds and tell us
 * nothing. Every random value in `world/` comes from here, never Math.random.
 */

/** mulberry32 — small, fast, good enough distribution for scattering. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic float in [min, max). */
export function range(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

/** Deterministic integer in [min, max]. */
export function rangeInt(rng: () => number, min: number, max: number): number {
  return Math.floor(range(rng, min, max + 1))
}

/** Deterministic sign, -1 or 1. */
export function sign(rng: () => number): number {
  return rng() < 0.5 ? -1 : 1
}

/**
 * Fixed seeds, one per scattered system. Named rather than inline so a change
 * to one system's layout cannot silently reshuffle another's.
 */
export const SEED = {
  fieldMonoliths: 0x5f3a91,
  motes: 0x21c4de,
  debris: 0x7b0e55,
  rain: 0x3d9a12,
  stars: 0x11aa77,
} as const
