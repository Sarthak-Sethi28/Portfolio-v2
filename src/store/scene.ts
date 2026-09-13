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
  arraySpacing: 46,
  // Far fewer.
  //
  // Procedural boxes cannot survive being looked at — the only things in this
  // scene that read as real are real meshes and the arch, which is genuinely
  // CONSTRUCTED rather than textured. A dozen distant silhouettes give the
  // horizon depth; forty nearby ones advertise that most of the world is
  // boxes. Fake and prominent is worse than sparse.
  fieldDensity: 13,
  // Halved. Fog lifts every distant value toward one mid-grey, and a scene
  // with no dark values in it cannot look lit — the reference frames keep
  // deep blacks in the joints and under the arch.
  fogDensity: 0.00092,
  // Off by default. Sub-pixel additive points flicker as they cross pixel
  // boundaries, and large enough to be stable they read as bright squares.
  // Available on the slider for anyone who wants them.
  moteCount: 0,
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
  /**
   * Environment-map strength, eased with the day/night blend.
   *
   * Lives here rather than in a ref because the frame loop writes it and the
   * render reads it — and reading a ref during render is a React Compiler
   * violation. Updated only when it moves meaningfully, so a continuous blend
   * costs a couple of dozen renders rather than one per frame.
   */
  envIntensity: number
  setEnvIntensity: (v: number) => void
  /** Day/night blend, mirrored from the frame loop for render-scope readers. */
  nightLevel: number
  setNightLevel: (v: number) => void
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
  // This worktree exists to develop the ARRIVAL, which is at night — so it
  // opens there rather than needing a keypress. The main instance stays day.
  night: true,
  rain: false,
  freelook: false,
  muted: true,
  quality: settingsFor('high'),
  reducedMotion: false,
  flags: {
    ao: false,
    noGate: false,
    still: false,
    noBloom: false,
    noMotes: false,
    noReflect: false,
    noPost: false,
    probe: false,
    under: false,
    closeup: false,
    noTex: false,
    noPlate: false,
    noUi: false,
    noSmaa: false,
    noMs: false,
  },
  flicker: [],
  envIntensity: 1.15,
  nightLevel: 0,

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
  setEnvIntensity: (envIntensity) => set({ envIntensity }),
  setNightLevel: (nightLevel) => set({ nightLevel }),
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
