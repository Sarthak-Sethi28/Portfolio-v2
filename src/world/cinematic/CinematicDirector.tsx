'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import { advanceCinematic, cinematicClock, resetCinematic, DURATION } from './cinematicState'
import { PortalGatewayLighting } from './PortalGatewayLighting'
import { TunnelAperture } from './TunnelAperture'
import { OceanChaos } from './OceanChaos'

/**
 * Advances the one clock, then mounts the visual systems that depend on it.
 *
 * The entire piece is one event now: ocean rupture -> red charge -> water
 * discharge -> sinking columns -> gateway pull -> Blender tunnel traversal.
 * These systems overlap on the same clock instead of handing off with visible
 * pauses.
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

    const t = cinematicClock.elapsed

    /*
     * PROJECTS is raised by BlenderTunnelTransition only after the actual night
     * destination is resolving. Keeping that authority out of the master clock
     * prevents the word from becoming a black title card between the tunnel and
     * the night world.
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
      {/*
       * No procedural RedCorridor here.
       *
       * final-run(9) exposed why: the Blender video ends while the old corridor's
       * black shell/cap is still active on the master timeline. As soon as the
       * DOM video clears, that shell becomes visible for a few frames, producing
       * the black wedge + red streaks before the night destination. The authored
       * Blender tunnel now owns the passage completely, so a second corridor is
       * both redundant and visually wrong.
       */}
      <TunnelAperture />
    </>
  )
}
