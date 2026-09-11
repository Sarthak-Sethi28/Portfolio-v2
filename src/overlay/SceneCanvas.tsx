'use client'

import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import { Stage } from '@/world/Stage'
import { useScene } from '@/store/scene'
import { detectTier } from '@/lib/quality'

/**
 * The canvas host.
 *
 * Resolution is picked once from the device and held for the session. Dynamic
 * DPR changes were one of the original sources of visible flashes, so visual
 * quality is improved through materials/lighting rather than resizing the
 * framebuffer while the user is looking at it.
 */
export function SceneCanvas() {
  const setQuality = useScene((s) => s.setQuality)
  const setReducedMotion = useScene((s) => s.setReducedMotion)
  const maxDpr = useScene((s) => s.quality.maxDpr)
  const dpr = Math.max(
    1,
    Math.floor(Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio)),
  )

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
      shadows="soft"
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      camera={{ fov: 56, near: 0.35, far: 6000, position: [0, 4.6, 58] }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Stage />
    </Canvas>
  )
}
