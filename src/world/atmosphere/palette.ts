import { Color, Vector3 } from 'three'

/**
 * The palette, sampled from the approved concept frames.
 *
 * Every colour in the scene resolves from here. Fog in particular MUST equal
 * the sky's horizon colour — if the two drift apart, distant geometry reads as
 * pasted onto the sky instead of receding into it, and the entire sense of
 * scale collapses.
 */

export interface Palette {
  skyZenith: Color
  skyHorizon: Color
  sunColor: Color
  /** Direction TO the sun, normalized. */
  sunDirection: Vector3
  /** Brightness of the sun DISC in the sky shader. Wants to be large. */
  sunIntensity: number
  /** Brightness of the directional key light on geometry. Deliberately
   *  separate: the sky needs a blown-out sun, the monoliths need to stay in
   *  silhouette, and one number cannot serve both. */
  keyIntensity: number
  /**
   * Derived from the sky, but pulled toward the zenith rather than set equal
   * to the horizon. Real aerial perspective cools with distance — matching the
   * warm horizon exactly turned every distant monolith cream instead of
   * letting it recede into haze.
   */
  fog: Color
  fogDensityScale: number
  monolith: Color
  /** Tint multiplied into the water's reflection. Slightly darker than 1 reads
   *  as water rather than as a mirror. */
  waterTint: Color
  ambient: Color
  ambientIntensity: number
}

export const DAY: Palette = {
  skyZenith: new Color('#4b6d76'),
  skyHorizon: new Color('#ecdcb9'),
  sunColor: new Color('#ffd8a0'),
  sunDirection: new Vector3(0.44, 0.04, -0.90).normalize(),
  sunIntensity: 3.4,
  keyIntensity: 2.4,
  fog: new Color('#b6bda6'),
  fogDensityScale: 1,
  // Stone grey, not black.
  //
  // The original concept framed these as black monoliths, and with no surface
  // texture black was the only thing that read. Now that they carry a
  // photographed limestone normal and roughness, a near-black base swallows
  // all of it — the pitting and cracks have nothing to modulate. Grey lets the
  // material show, which is what "weathered stone" actually means.
  monolith: new Color('#8a8e88'),
  waterTint: new Color('#e8ece7'),
  ambient: new Color('#5d7a80'),
  ambientIntensity: 0.10,
}

export const NIGHT: Palette = {
  skyZenith: new Color('#02040b'),
  skyHorizon: new Color('#0a1524'),
  sunColor: new Color('#9fb6d8'),
  /*
   * The moon sits HIGH and near the view axis.
   *
   * Low and centred it landed at exactly the height of the name, so the title
   * ran straight through it — the disc appeared to be resting on the K.
   * Raised, it frames in the upper half of the ring's opening, above the type,
   * which is a better composition than the accident was.
   */
  sunDirection: new Vector3(0.05, 0.46, -0.89).normalize(),
  // Moonlight is DIM but HARD.
  //
  // Night was built by turning the day lights down, which is the wrong model
  // — it gives a uniformly murky frame rather than a dark one. Real night is
  // extreme contrast: a single cold key that rims an edge, and genuine black
  // behind it. So the key stays low but the FILL goes to almost nothing.
  sunIntensity: 1.6,
  keyIntensity: 0.5,
  fog: new Color('#070e1a'),
  fogDensityScale: 1.35,
  monolith: new Color('#2b3138'),
  waterTint: new Color('#0a1220'),
  ambient: new Color('#0b1a2e'),
  ambientIntensity: 0.03,
}

/** Linear blend between the two palettes. `t` of 0 is day, 1 is night. */
export function blendPalette(t: number, out: Palette): Palette {
  out.skyZenith.copy(DAY.skyZenith).lerp(NIGHT.skyZenith, t)
  out.skyHorizon.copy(DAY.skyHorizon).lerp(NIGHT.skyHorizon, t)
  out.sunColor.copy(DAY.sunColor).lerp(NIGHT.sunColor, t)
  out.sunDirection.copy(DAY.sunDirection).lerp(NIGHT.sunDirection, t).normalize()
  out.sunIntensity = DAY.sunIntensity + (NIGHT.sunIntensity - DAY.sunIntensity) * t
  out.keyIntensity = DAY.keyIntensity + (NIGHT.keyIntensity - DAY.keyIntensity) * t
  out.fog.copy(out.skyHorizon).lerp(out.skyZenith, 0.42)
  out.fogDensityScale = DAY.fogDensityScale + (NIGHT.fogDensityScale - DAY.fogDensityScale) * t
  out.monolith.copy(DAY.monolith).lerp(NIGHT.monolith, t)
  out.waterTint.copy(DAY.waterTint).lerp(NIGHT.waterTint, t)
  out.ambient.copy(DAY.ambient).lerp(NIGHT.ambient, t)
  out.ambientIntensity =
    DAY.ambientIntensity + (NIGHT.ambientIntensity - DAY.ambientIntensity) * t
  return out
}

/** A mutable palette instance for the render loop to write into each frame. */
export function createPalette(): Palette {
  return {
    skyZenith: DAY.skyZenith.clone(),
    skyHorizon: DAY.skyHorizon.clone(),
    sunColor: DAY.sunColor.clone(),
    sunDirection: DAY.sunDirection.clone(),
    sunIntensity: DAY.sunIntensity,
    keyIntensity: DAY.keyIntensity,
    fog: DAY.fog.clone(),
    fogDensityScale: DAY.fogDensityScale,
    monolith: DAY.monolith.clone(),
    waterTint: DAY.waterTint.clone(),
    ambient: DAY.ambient.clone(),
    ambientIntensity: DAY.ambientIntensity,
  }
}
