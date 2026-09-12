/**
 * Device capability detection -> quality tier.
 *
 * Decided once at boot, before the first frame, so the scene never has to
 * rebuild itself mid-session. Tiers are defined in the spec, section 6.
 */

export type Tier = 'high' | 'medium' | 'low'

export interface QualitySettings {
  tier: Tier
  /** Reflector render-target resolution. 0 disables reflection entirely. */
  reflectorResolution: number
  /** Multiplier applied to every scattered-particle count. */
  particleScale: number
  bloom: boolean
  depthOfField: boolean
  /** Upper bound for device pixel ratio. */
  maxDpr: number
  /** Rain is the most expensive optional system. */
  rainEnabled: boolean
}

const SETTINGS: Record<Tier, Omit<QualitySettings, 'tier'>> = {
  high: {
    // 768.
    //
    // The reflector renders the entire scene a second time every frame. 2048
    // cost roughly 70fps; 1024 is affordable on paper but the pass is long
    // enough that under load it can land late, and a late reflection shows as
    // a dark flash in the water while the camera moves. 768 shortens it
    // materially and the surface is blurred anyway.
    reflectorResolution: 768,
    particleScale: 1,
    bloom: true,
    depthOfField: true,
    // MUST be an integer.
    //
    // A fractional pixel ratio means the browser resamples every frame by a
    // non-integer factor on the way to the panel. Standing still that is
    // invisible; in motion each edge lands on a different sub-pixel phase
    // every frame and shimmers. It survived every other fix because it is not
    // in the scene at all — it is the scale between the framebuffer and the
    // display.
    maxDpr: 2,
    rainEnabled: true,
  },
  medium: {
    reflectorResolution: 1024,
    particleScale: 0.5,
    bloom: true,
    depthOfField: false,
    maxDpr: 1,
    rainEnabled: true,
  },
  low: {
    // Still reflective, just cheaply. Losing the mirror is losing the world.
    reflectorResolution: 512,
    particleScale: 0.25,
    bloom: false,
    depthOfField: false,
    maxDpr: 1,
    rainEnabled: false,
  },
}

export function settingsFor(tier: Tier): QualitySettings {
  return { tier, ...SETTINGS[tier] }
}

/** Inputs to tier selection, extracted so the decision itself stays testable. */
export interface DeviceProfile {
  /** navigator.deviceMemory in GB, undefined when unreported. */
  deviceMemory?: number
  hardwareConcurrency: number
  /** WEBGL_debug_renderer_info UNMASKED_RENDERER_WEBGL, lowercased. */
  renderer: string
  /** Coarse pointer implies touch, which implies a mobile GPU. */
  coarsePointer: boolean
  prefersReducedMotion: boolean
}

/**
 * Pure, so it can be unit-tested against known device profiles rather than
 * only discovered on real hardware.
 */
export function selectTier(p: DeviceProfile): Tier {
  // NOTE: prefers-reduced-motion deliberately does NOT affect the tier.
  //
  // An earlier version returned 'low' for it, which silently disabled the
  // water reflection — and since the key light rakes in almost horizontally, a
  // flat unlit plane renders BLACK. Anyone with Reduce Motion enabled lost the
  // entire mirrored plain, which is half the composition. Reduced motion is a
  // request to stop things MOVING; it says nothing about the GPU. It is
  // handled in the camera rig and the animated systems instead.

  // Software renderers appear in CI and in browsers with GPU blocklists. They
  // cannot sustain a reflector at any resolution.
  if (/swiftshader|llvmpipe|softwarerasterizer|angle \(software/.test(p.renderer)) {
    return 'low'
  }

  const weakMemory = p.deviceMemory !== undefined && p.deviceMemory <= 4
  const weakCpu = p.hardwareConcurrency <= 4

  if (p.coarsePointer) {
    // Mobile. Apple's mobile GPUs carry a reflector at half res; most others do not.
    return /apple/.test(p.renderer) && !weakMemory ? 'medium' : 'low'
  }

  if (weakMemory || weakCpu) return 'medium'
  return 'high'
}

/** Reads the live browser environment. Returns 'medium' during SSR. */
export function detectTier(): Tier {
  if (typeof window === 'undefined') return 'medium'

  let renderer = ''
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return 'low'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase()
  } catch {
    return 'low'
  }

  return selectTier({
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
    renderer,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
    prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  })
}

/** True when WebGL is unavailable and the text fallback must be served instead. */
export function hasWebGL(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}
