import { Color, Vector3 } from 'three'

export interface Palette {
  skyZenith: Color
  skyHorizon: Color
  sunColor: Color
  sunDirection: Vector3
  sunIntensity: number
  keyIntensity: number
  fog: Color
  fogDensityScale: number
  monolith: Color
  waterTint: Color
  ambient: Color
  ambientIntensity: number
}

/**
 * The slabs were previously almost literal black (#020304). That works for a
 * graphic silhouette, but it erases every physically based cue we add to the
 * surface. These values stay very dark while leaving enough luminance for
 * grazing light, bump detail and environment fill to describe the concrete.
 */
export const DAY: Palette = {
  skyZenith: new Color('#4b6d76'),
  skyHorizon: new Color('#ecdcb9'),
  sunColor: new Color('#ffd8a0'),
  sunDirection: new Vector3(0.44, 0.04, -0.90).normalize(),
  sunIntensity: 3.4,
  keyIntensity: 1.02,
  fog: new Color('#b6bda6'),
  fogDensityScale: 1,
  monolith: new Color('#101517'),
  waterTint: new Color('#dce3e1'),
  ambient: new Color('#607f86'),
  ambientIntensity: 0.22,
}

export const NIGHT: Palette = {
  skyZenith: new Color('#03060f'),
  skyHorizon: new Color('#16273f'),
  sunColor: new Color('#9fb6d8'),
  sunDirection: new Vector3(-0.45, 0.22, 0.86).normalize(),
  sunIntensity: 0.35,
  keyIntensity: 0.2,
  fog: new Color('#0e1c2e'),
  fogDensityScale: 1.35,
  monolith: new Color('#070b0e'),
  waterTint: new Color('#6f819a'),
  ambient: new Color('#1a3555'),
  ambientIntensity: 0.18,
}

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
