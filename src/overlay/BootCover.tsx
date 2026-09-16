'use client'

import { useEffect } from 'react'
import { useScene } from '@/store/scene'

/**
 * What the visitor sees while the world is still being built.
 *
 * The sky, the sun, the lights and this title are all OUTSIDE the Suspense
 * boundary that holds the ocean, the piers and the portal, so for the first
 * second of every cold load the page drew a complete-looking scene that simply
 * had no world in it: horizon, sun, name, nothing else. It does not read as
 * loading — it reads as broken, which is exactly how it was reported.
 *
 * So the gap is held instead of exposed. This is deliberately not a progress
 * bar or a splash: it is the scene's own darkness, released the moment
 * WorldReady confirms real frames are being drawn.
 */
export function BootCover() {
  const phase = useScene((s) => s.phase)
  const setPhase = useScene((s) => s.setPhase)

  useEffect(() => {
    if (phase !== 'revealing') return
    const id = window.setTimeout(() => setPhase('live'), 620)
    return () => window.clearTimeout(id)
  }, [phase, setPhase])

  const booting = phase === 'booting'

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50"
      style={{
        background: '#05070a',
        opacity: booting ? 1 : 0,
        transition: 'opacity 620ms ease-out',
        // Once it is gone it must not keep compositing a full-screen layer over
        // every frame of the cinematic for the rest of the session.
        visibility: phase === 'live' ? 'hidden' : 'visible',
      }}
    />
  )
}
