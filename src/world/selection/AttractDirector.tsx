'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import { cinematicSample } from '../cinematic/cinematicState'
import {
  ATTRACT_DELAY,
  ATTRACT_PERIOD,
  ATTRACT_PULSES,
  attract,
  attractDone,
  silenceAttract,
} from './attract'

/**
 * Runs the nudge, once, when the world has been sitting still long enough.
 *
 * The clock only advances while nothing else is happening: not during the
 * crossing, not while a monument is open, and not once the visitor has touched
 * a column. So the hint arrives for somebody who is looking at a still picture
 * and wondering what to do, and never interrupts somebody who is already doing
 * something.
 */
export function AttractDirector() {
  const hovered = useScene((s) => s.hovered)
  const openSection = useScene((s) => s.openSection)
  const cinematic = useScene((s) => s.cinematic)
  const reducedMotion = useScene((s) => s.reducedMotion)

  const idle = useRef(0)

  /* eslint-disable react-hooks/immutability */
  useFrame((_, delta) => {
    // Any contact with a column means the visitor has worked it out. Done for
    // the session.
    if (hovered !== null || openSection !== null) {
      silenceAttract()
      return
    }

    if (
      attractDone.value ||
      reducedMotion ||
      cinematic === 'playing' ||
      cinematicSample.disturbance > 0.01
    ) {
      attract.value = 0
      return
    }

    idle.current += Math.min(delta, 1 / 20)
    const since = idle.current - ATTRACT_DELAY
    if (since < 0) {
      attract.value = 0
      return
    }

    const total = ATTRACT_PERIOD * ATTRACT_PULSES
    if (since > total) {
      // Said its piece. Never again.
      silenceAttract()
      return
    }

    /*
     * A half-sine per pulse: up and back down, ending exactly at zero.
     *
     * Using sin rather than a sawtooth means the column is never dropped — it
     * arrives at rest with zero velocity, which is what stops this reading as a
     * twitch.
     */
    const phase = (since % ATTRACT_PERIOD) / ATTRACT_PERIOD
    attract.value = Math.sin(phase * Math.PI)
  })
  /* eslint-enable react-hooks/immutability */

  return null
}
