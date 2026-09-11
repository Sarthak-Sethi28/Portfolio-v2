'use client'

import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { Stage } from '@/world/Stage'
import { useScene } from '@/store/scene'
import { detectTier } from '@/lib/quality'

/**
 * The canvas host.
 *
 * Owns exactly two responsibilities: detect the device's capability once
 * before the first frame, and let the renderer degrade itself if the frame
 * budget slips afterwards. Everything visual lives in Stage.
 */
export function SceneCanvas() {
  const setQuality = useScene((s) => s.setQuality)
  const setReducedMotion = useScene((s) => s.setReducedMotion)
  const maxDpr = useScene((s) => s.quality.maxDpr)

  /**
   * A ceiling the performance monitor may lower at runtime. Kept separate from
   * the tier's own cap and combined during render rather than synced in an
   * effect, which would cascade a re-render every time the tier changed.
   */
  const [ceiling, setCeiling] = useState(2)
  const dpr: [number, number] = [1, Math.min(maxDpr, ceiling)]

  useEffect(() => {
    setQuality(detectTier())

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [setQuality, setReducedMotion])

  return (
    <Canvas
      dpr={dpr}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 56, near: 0.35, far: 2600, position: [0, 4.6, 58] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Drops resolution before it drops frames. */}
      <PerformanceMonitor onDecline={() => setCeiling((c) => Math.max(1, c - 0.5))} />
      <AdaptiveDpr pixelated={false} />
      <AdaptiveEvents />
      <Stage />
    </Canvas>
  )
}
