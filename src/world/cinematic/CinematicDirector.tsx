'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import { advanceCinematic, cinematicClock, resetCinematic, DURATION } from './cinematicState'
import { PortalGatewayLighting } from './PortalGatewayLighting'
import { PortalTransitionOverlay } from './PortalTransitionOverlay'

/**
 * Advances the one clock, then mounts the two visual systems that depend on it.
 *
 * This component is mounted before the rest of the cinematic consumers, so its
 * frame callback writes the authoritative sample first. The lighting and final
 * transition overlay below therefore always read the same frame the world does.
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
    // A restored/background tab must not jump the entire piece in one update.
    advanceCinematic(Math.min(delta, 1 / 20))

    /*
     * The title changes only while Frame 15 is already black. The previous
     * 14.72 handoff was later than the new physical crossing; 14.50 sits safely
     * inside the black/red transition and gives the destination the final half
     * second to resolve rather than popping at the very end.
     */
    const t = cinematicClock.elapsed
    if (!arrivedTitle && t >= 14.50) setArrivedTitle(true)
    else if (arrivedTitle && t < 14.34 && cinematicClock.scrub !== null) setArrivedTitle(false)

    if (cinematicClock.running && cinematicClock.elapsed >= DURATION) {
      cinematicClock.running = false
      setNight(true)
      setCinematic('complete')
    }
  })

  return (
    <>
      <PortalGatewayLighting />
      <PortalTransitionOverlay />
    </>
  )
}
