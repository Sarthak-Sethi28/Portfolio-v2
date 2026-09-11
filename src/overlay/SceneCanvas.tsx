'use client'

import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
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
  const maxDpr = useScene((s) => s.quality.maxDpr)

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
      // Fixed for the session, never recomputed from frame timings. The store
      // starts at the high tier, so on capable hardware detection confirms the
      // value and the buffer is never resized at all.
      dpr={maxDpr}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 56, near: 0.35, far: 6000, position: [0, 4.6, 58] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Stage />
    </Canvas>
  )
}
