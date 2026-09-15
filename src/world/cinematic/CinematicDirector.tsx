'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import { advanceCinematic, cinematicClock, resetCinematic, DURATION } from './cinematicState'
import { PortalGatewayLighting } from './PortalGatewayLighting'
import { OceanSplashSurge } from './OceanSplashSurge'
import { PortalTransitVolume } from './PortalTransitVolume'

/**
 * Advances the one clock, then mounts the visual systems that depend on it.
 *
 * This pass removes the two things that made the previous render feel fake:
 * the elevated circular "ocean rupture" patch and the fullscreen radial red
 * warp. Water now breaks out of the actual surface, and the portal transition
 * is a real 3D volume the camera flies through.
 */
export function CinematicDirector() {
  const status = useScene((s) => s.cinematic)
  const setCinematic = useScene((s) => s.setCinematic)
  const setNight = useScene((s) => s.setNight)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const seqFlag = useScene((s) => s.flags.seq)
  const arrivedTitle = useScene((s) => s.arrivedTitle)
  const setArrivedTitle = useScene((s) => s.setArrivedTitle)

  useEffect(() => {
    cinematicClock.scrub = seqFlag === null ? null : seqFlag * DURATION
  }, [seqFlag])

  useEffect(() => {
    if (status === 'playing') {
      if (reducedMotion) {
        resetCinematic()
        setNight(true)
        setCinematic('complete')
        return
      }
      cinematicClock.elapsed = 0
      cinematicClock.running = true
      setArrivedTitle(false)
    }
  }, [status, reducedMotion, setNight, setCinematic, setArrivedTitle])

  useFrame((_, delta) => {
    advanceCinematic(Math.min(delta, 1 / 20))

    const t = cinematicClock.elapsed
    if (!arrivedTitle && t >= 14.50) setArrivedTitle(true)
    else if (arrivedTitle && t < 14.30 && cinematicClock.scrub !== null) setArrivedTitle(false)

    if (cinematicClock.running && cinematicClock.elapsed >= DURATION) {
      cinematicClock.running = false
      setNight(true)
      setCinematic('complete')
    }
  })

  return (
    <>
      <OceanSplashSurge />
      <PortalGatewayLighting />
      <PortalTransitVolume />
    </>
  )
}
