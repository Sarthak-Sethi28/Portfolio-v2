'use client'

import { Canvas } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { Stage } from '@/world/Stage'
import { useScene } from '@/store/scene'
import { detectTier } from '@/lib/quality'

/**
 * The canvas host.
 *
 * Detects the device's capability once, before the first frame, and then
 * leaves the resolution alone.
 *
 * It used to run AdaptiveDpr and a PerformanceMonitor that stepped the pixel
 * ratio down whenever the frame rate dipped. That is a reasonable idea and a
 * terrible experience: every step resizes the drawing buffer, and on a scene
 * this dark each resize lands as a visible flash. A monitor that reacts to
 * dips caused by its own resizes then oscillates, and the whole page appears
 * to flicker. Pick a resolution from the device and hold it.
 */
export function SceneCanvas() {
  const setQuality = useScene((s) => s.setQuality)
  const setReducedMotion = useScene((s) => s.setReducedMotion)
  /**
   * Resolved ONCE, at mount, and never again.
   *
   * This was derived from the quality tier, which the store initialises to
   * "high" and then replaces from detectTier() in an effect. When that changed
   * maxDpr the Canvas resized — but EffectComposer's internal render targets
   * did not reliably follow, leaving the scene drawn into a fraction of the
   * viewport with the rest black. Alternating between the two is a violent
   * full-frame flicker, and it is NOT the sub-pixel shimmer that looks similar.
   *
   * A lazy initialiser means the value is computed before the first frame and
   * is stable for the life of the canvas, so no resize can ever be missed.
   */
  const [dpr] = useState(() => {
    if (typeof window === 'undefined') return 1
    // Whole numbers only: a fractional ratio makes the browser resample every
    // frame by a non-integer factor on the way to the panel.
    return Math.max(1, Math.min(2, Math.floor(window.devicePixelRatio)))
  })

  const applyFlags = useScene((s) => s.applyFlags)

  useEffect(() => {
    applyFlags()
    setQuality(detectTier())

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)

    return () => mq.removeEventListener('change', onChange)
  }, [applyFlags, setQuality, setReducedMotion])

  return (
    <Canvas
      dpr={dpr}
      // Guarantee the composer and the canvas can never disagree about size:
      // re-resolve on every resize rather than trusting the observer alone.
      resize={{ scroll: false, debounce: { scroll: 0, resize: 0 } }}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 50, near: 0.35, far: 6000, position: [0, 52, 168] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Stage />
    </Canvas>
  )
}
