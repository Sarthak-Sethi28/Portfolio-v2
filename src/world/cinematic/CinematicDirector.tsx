'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import {
  advanceCinematic,
  cinematicClock,
  cinematicDirection,
  resetCinematic,
  DURATION,
} from './cinematicState'
import { PortalGatewayLighting } from './PortalGatewayLighting'
import { TunnelAperture } from './TunnelAperture'
import { OceanChaos } from './OceanChaos'
import { OceanWhitewater } from './OceanWhitewater'

/**
 * One deterministic journey in either direction.
 *
 * Forward: day -> storm -> portal -> Blender tunnel -> night.
 * Reverse: night -> tunnel -> portal -> storm unwinds -> day.
 *
 * The same timeline is sampled backward rather than inventing a second set of
 * effects, so pillars, red charge, whitewater and daylight all return through
 * the exact values they used on the way in.
 */
export function CinematicDirector() {
  const status = useScene((s) => s.cinematic)
  const setCinematic = useScene((s) => s.setCinematic)
  const setNight = useScene((s) => s.setNight)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const seqFlag = useScene((s) => s.flags.seq)
  const arrivedTitle = useScene((s) => s.arrivedTitle)
  const setArrivedTitle = useScene((s) => s.setArrivedTitle)

  // A scrub is authoritative: nothing may advance the clock behind it.
  useEffect(() => {
    cinematicClock.scrub = seqFlag === null ? null : seqFlag * DURATION
  }, [seqFlag])

  useEffect(() => {
    if (status !== 'playing') return

    const direction = cinematicDirection.value

    if (reducedMotion) {
      if (direction > 0) {
        cinematicClock.elapsed = DURATION
        cinematicClock.running = false
        setNight(true)
        setArrivedTitle(true)
        setCinematic('complete')
      } else {
        resetCinematic()
        setNight(false)
        setArrivedTitle(false)
        setCinematic('idle')
      }
      return
    }

    // Start from the endpoint we are physically standing at.
    cinematicClock.elapsed = direction > 0 ? 0 : DURATION
    cinematicClock.running = true

    // The destination word belongs only to the held night shot. It clears the
    // instant a return trip begins and is raised again only on forward arrival.
    setArrivedTitle(false)
  }, [status, reducedMotion, setNight, setCinematic, setArrivedTitle])

  useFrame((_, delta) => {
    // A restored/background tab must not jump the entire piece in one update.
    advanceCinematic(Math.min(delta, 1 / 20))

    const t = cinematicClock.elapsed
    const direction = cinematicDirection.value

    if (arrivedTitle && t < 14.30 && cinematicClock.scrub !== null) {
      setArrivedTitle(false)
    }

    if (!cinematicClock.running) return

    if (direction > 0 && t >= DURATION) {
      cinematicClock.running = false
      setNight(true)
      setCinematic('complete')
      return
    }

    if (direction < 0 && t <= 0) {
      cinematicClock.running = false
      setNight(false)
      setArrivedTitle(false)
      setCinematic('idle')
    }
  })

  return (
    <>
      {/* Full-ocean rough whitewater first, then the stronger local gate event. */}
      <OceanWhitewater />
      <OceanChaos />
      <PortalGatewayLighting />
      {/* Blender owns the transit completely; no procedural corridor stacked on it. */}
      <TunnelAperture />
    </>
  )
}
