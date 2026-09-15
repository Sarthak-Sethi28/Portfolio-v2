'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import { advanceCinematic, cinematicClock, resetCinematic, DURATION } from './cinematicState'
import { PortalGatewayLighting } from './PortalGatewayLighting'
import { RedCorridor } from './RedCorridor'
import { TunnelAperture } from './TunnelAperture'
import { OceanChaos } from './OceanChaos'

/**
 * Advances the one clock, then mounts the visual systems that depend on it.
 *
 * The entire piece is one event now: ocean rupture -> red charge -> water
 * discharge -> sinking columns -> gateway pull -> bore traversal. These systems
 * overlap on the same clock instead of handing off with visible pauses.
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

    // Swap the title only when the red/black travel layer is already covering
    // the destination handback.
    const t = cinematicClock.elapsed
    /*
     * The title is NOT raised here any more.
     *
     * Firing it on the master clock put PROJECTS on screen while the tunnel's
     * black core was still covering everything, which produced a black title
     * card sitting between the tunnel and the night world. The word belongs
     * over the completed night composition, so the transition raises it once
     * that composition is actually readable — see BlenderTunnelTransition.
     */
    if (arrivedTitle && t < 14.30 && cinematicClock.scrub !== null) setArrivedTitle(false)

    if (cinematicClock.running && cinematicClock.elapsed >= DURATION) {
      cinematicClock.running = false
      setNight(true)
      setCinematic('complete')
    }
  })

  return (
    <>
      <OceanChaos />
      <PortalGatewayLighting />
      <RedCorridor />
      <TunnelAperture />
    </>
  )
}
