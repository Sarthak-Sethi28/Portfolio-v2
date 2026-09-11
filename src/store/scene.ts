import { create } from 'zustand'
import type { SectionId } from '@/content'
import { settingsFor, type QualitySettings, type Tier } from '@/lib/quality'
import { readFlags, type Flags } from '@/lib/flags'

/**
 * The only channel between world/ and overlay/.
 *
 * Neither side imports the other. The overlay writes intent here; the world
 * reads it and animates toward it. That boundary is what lets the entire UI be
 * driven in Playwright without a GPU.
 */

export type WorldId = 'array' | 'aperture'
export type Phase = 'booting' | 'revealing' | 'live'

/** Live-tunable parameters exposed by the SYS.CONFIG panel. */
export interface Config {
  /** Distribution radius of the whole array, in world units. */
  arraySpacing: number
  /** Count of DECORATIVE monoliths only. The four section monoliths are fixed
   *  and unreachable from here — a settings panel must never be able to delete
   *  the site's navigation. */
  fieldDensity: number
  fogDensity: number
  moteCount: number
  cursorRepelForce: number
  waterRoughness: number
}

export const CONFIG_DEFAULTS: Config = {
  arraySpacing: 42,
  fieldDensity: 18,
  fogDensity: 0.0019,
  moteCount: 150,
  cursorRepelForce: 1,
  waterRoughness: 0.11,
}

export const CONFIG_BOUNDS: Record<keyof Config, { min: number; max: number; step: number }> = {
  arraySpacing: { min: 18, max: 70, step: 1 },
  fieldDensity: { min: 0, max: 60, step: 1 },
  fogDensity: { min: 0.0008, max: 0.02, step: 0.0004 },
  moteCount: { min: 0, max: 1500, step: 10 },
  cursorRepelForce: { min: 0, max: 3, step: 0.1 },
  waterRoughness: { min: 0, max: 1, step: 0.01 },
}

interface SceneState {
  phase: Phase
  world: WorldId
  night: boolean
  rain: boolean
  freelook: boolean
  muted: boolean
  quality: QualitySettings
  reducedMotion: boolean
  /** URL debug flags. Read once at startup; see lib/flags.ts. */
  flags: Flags
  applyFlags: () => void
  /** Peak frame-to-frame luminance delta per probe region. */
  flicker: number[]
  setFlicker: (v: number[]) => void

  /** Section monolith under the pointer, or null. */
  hovered: SectionId | null
  /** Section panel currently open, or null. */
  openSection: SectionId | null
  /** Project slug currently open in the aperture world, or null. */
  openProject: string | null

  config: Config

  setPhase: (p: Phase) => void
  setWorld: (w: WorldId) => void
  toggleNight: () => void
  toggleRain: () => void
  toggleFreelook: () => void
  toggleMuted: () => void
  setQuality: (t: Tier) => void
  setReducedMotion: (v: boolean) => void
  setHovered: (s: SectionId | null) => void
  openSectionPanel: (s: SectionId | null) => void
  openProjectPanel: (slug: string | null) => void
  setConfig: <K extends keyof Config>(key: K, value: Config[K]) => void
  resetConfig: () => void
  /** Closes whatever is open. Bound to Escape. */
  dismiss: () => void
}

export const useScene = create<SceneState>((set) => ({
  phase: 'booting',
  world: 'array',
  night: false,
  rain: false,
  freelook: false,
  muted: true,
  quality: settingsFor('high'),
  reducedMotion: false,
  flags: {
    still: false,
    noBloom: false,
    noMotes: false,
    noReflect: false,
    noPost: false,
    probe: false,
  },
  flicker: [],

  hovered: null,
  openSection: null,
  openProject: null,

  config: { ...CONFIG_DEFAULTS },

  setPhase: (phase) => set({ phase }),
  setWorld: (world) => set({ world, openSection: null, openProject: null }),
  toggleNight: () => set((s) => ({ night: !s.night })),
  toggleRain: () => set((s) => ({ rain: !s.rain })),
  toggleFreelook: () => set((s) => ({ freelook: !s.freelook })),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setQuality: (tier) => set({ quality: settingsFor(tier) }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  applyFlags: () => set({ flags: readFlags() }),
  setFlicker: (flicker) => set({ flicker }),
  setHovered: (hovered) => set({ hovered }),
  openSectionPanel: (openSection) => set({ openSection, openProject: null }),
  openProjectPanel: (openProject) => set({ openProject, openSection: null }),

  setConfig: (key, value) => set((s) => ({ config: { ...s.config, [key]: value } })),
  resetConfig: () => set({ config: { ...CONFIG_DEFAULTS } }),

  dismiss: () => set({ openSection: null, openProject: null }),
}))

/** Effective mote count after the quality multiplier. */
export function effectiveMoteCount(s: { config: Config; quality: QualitySettings }): number {
  return Math.round(s.config.moteCount * s.quality.particleScale)
}
