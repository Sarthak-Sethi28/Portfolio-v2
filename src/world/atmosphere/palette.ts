import { Color, Vector3 } from 'three'

/**
 * Scene palette. The important change in this pass is material latitude: the
 * concrete is no longer almost literal black. Jace-style high-fidelity scenes
 * work because stone still has enough midtone range for normal maps, edge
 * light, weathering and AO-like depth to be visible. We keep the architecture
 * dark, but stop throwing away the information before tone mapping.
 */
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

export const DAY: Palette = {
  skyZenith: new Color('#496a75'),
  skyHorizon: new Color('#e8d9bc'),
  sunColor: new Color('#ffd7a5'),
  sunDirection: new Vector3(0.44, 0.075, -0.895).normalize(),
  sunIntensity: 3.05,
  keyIntensity: 1.18,
  fog: new Color('#b3bba9'),
  fogDensityScale: 1,
  // Neutral charcoal stone, not black and not warm brown. The procedural
  // albedo map multiplies this and supplies the local colour variation.
  monolith: new Color('#555b58'),
  waterTint: new Color('#a8b9b8'),
  ambient: new Color('#607e86'),
  ambientIntensity: 0.22,
}

export const NIGHT: Palette = {
  skyZenith: new Color('#03060f'),
  skyHorizon: new Color('#16273f'),
  sunColor: new Color('#9fb6d8'),
  sunDirection: new Vector3(-0.45, 0.22, 0.86).normalize(),
  sunIntensity: 0.32,
  keyIntensity: 0.2,
  fog: new Color('#0e1c2e'),
  fogDensityScale: 1.35,
  monolith: new Color('#1a2023'),
  waterTint: new Color('#63778d'),
  ambient: new Color('#18314f'),
  ambientIntensity: 0.17,
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
