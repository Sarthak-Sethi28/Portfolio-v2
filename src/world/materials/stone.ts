import { RepeatWrapping, type Texture } from 'three'

/**
 * Weathered limestone, from a photograph.
 *
 * The piers had geometry but no surface, so they read as grey blocks however
 * carefully they were modelled. A photographed stone carries what no
 * procedural field does — pitting and hairline cracks at irregular intervals,
 * staining that follows no rule — and that irregularity is most of what the
 * eye uses to decide something is a real material.
 *
 * Normals come from the photograph's luminance (scripts/make-water-normal.mjs);
 * the same image drives roughness, since the pits that read dark are also the
 * parts that scatter light.
 */

/** Tile size in world units. One repeat covers roughly this much surface. */
const TILE = 9

export function tileStone(tex: Texture, worldWidth: number, worldHeight: number, aniso: number) {
  const t = tex.clone()
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  // Scaled to world size so a short pier and a tall one share a grain, rather
  // than one looking like a scaled photograph of the other.
  t.repeat.set(Math.max(1, worldWidth / TILE), Math.max(1, worldHeight / TILE))
  t.anisotropy = aniso
  t.needsUpdate = true
  return t
}
