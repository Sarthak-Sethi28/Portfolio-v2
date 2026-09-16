'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import {
  advanceCinematic,
  cinematicClock,
  cinematicDirection,
  resetCinematic,
  returnJourney,
  setCinematicTime,
  DURATION,
} from './cinematicState'
import { PortalGatewayLighting } from './PortalGatewayLighting'
import { TunnelAperture } from './TunnelAperture'
import { OceanChaos } from './OceanChaos'

/**
 * Forward is the authored 15s DAY -> NIGHT event.
 *
 * Return is intentionally NOT that event at negative speed. Pressing F at
 * night starts a new forward portal approach, the Blender tunnel covers the
 * screen, and DAY is restored underneath that darkness. Nothing visibly runs
 * backward anymore.
 */
export function CinematicDirector() {
  const status = useScene((s) => s.cinematic)
  const setCinematic = useScene((s) => s.setCinematic)
  const setNight = useScene((s) => s.setNight)
  const reducedMotion = useScene((s) => s.reducedMotion)
  const seqFlag = useScene((s) => s.flags.seq)
  const arrivedTitle = useScene((s) => s.arrivedTitle)
  const setArrivedTitle = useScene((s) => s.setArrivedTitle)
  const openSectionPanel = useScene((s) => s.openSectionPanel)

  /*
   * Every mount begins in DAY, from zero.
   *
   * The clock, the direction and the return journey live in module scope, and
   * module scope does not survive a reload — but it DOES survive a remount, and
   * "a refresh will have cleared it" is the sort of assumption that holds right
   * up until the day it doesn't. Saying it costs one call and removes the whole
   * class of question.
   */
  useEffect(() => {
    resetCinematic()
  }, [])

  useEffect(() => {
    cinematicClock.scrub = seqFlag === null ? null : seqFlag * DURATION
  }, [seqFlag])

  useEffect(() => {
    if (status !== 'playing') return

    /*
     * A raised pillar has no business surviving into the journey.
     *
     * Handled here rather than in the key handler so that every route into the
     * cinematic — the F key today, a button tomorrow — closes the panel, and
     * the camera hands cleanly from SelectionRig to the portal rig instead of
     * two of them writing the same camera on the first frame.
     */
    openSectionPanel(null)

    const direction = cinematicDirection.value

    if (reducedMotion) {
      if (direction > 0) {
        setCinematicTime(DURATION)
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

    setArrivedTitle(false)

    if (direction > 0) {
      returnJourney.active = false
      returnJourney.elapsed = 0
      setCinematicTime(0)
      cinematicClock.running = true
      return
    }

    // Hold the finished night world exactly as-is while the dedicated return
    // camera flies INTO the red ring. The tunnel later hides the DAY reset.
    setCinematicTime(DURATION)
    cinematicClock.running = false
    returnJourney.active = true
    returnJourney.elapsed = 0
  }, [status, reducedMotion, setNight, setCinematic, setArrivedTitle, openSectionPanel])

  useFrame((_, delta) => {
    advanceCinematic(Math.min(delta, 1 / 20))

    const t = cinematicClock.elapsed

    if (arrivedTitle && t < 14.30 && cinematicClock.scrub !== null) {
      setArrivedTitle(false)
    }

    if (
      cinematicDirection.value > 0 &&
      cinematicClock.running &&
      t >= DURATION
    ) {
      cinematicClock.running = false
      setNight(true)
      setCinematic('complete')
    }
  })

  return (
    <>
      {/* The real Water mesh now owns the whole-ocean deformation. */}
      <OceanChaos />
      <PortalGatewayLighting />
      <TunnelAperture />
    </>
  )
}
