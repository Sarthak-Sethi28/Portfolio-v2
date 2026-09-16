'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import { cinematicSample, worldNight } from '../cinematic/cinematicState'
import { resumeAudio, setLevel, updateAudio } from './waterAudio'

/**
 * Drives the sound from the same sample the water is drawn from.
 *
 * Lives inside the Canvas purely to get a frame callback — it renders nothing.
 * Reading the mutable sample here rather than subscribing to the store is the
 * same decision made everywhere else in this world: these values change every
 * frame, and nothing that changes every frame may travel through React.
 *
 * Sound is OFF until asked for. A portfolio that starts making noise the moment
 * it loads is the one thing guaranteed to be closed immediately — someone opens
 * it in a library, or in an office, or over a meeting. The store already
 * defaults `muted` to true; this respects that and nothing plays until the
 * visitor turns it on.
 */
export function AudioDirector() {
  const muted = useScene((s) => s.muted)

  useEffect(() => {
    if (muted) {
      setLevel(0)
      return
    }
    // Unmuting IS the gesture, so this is exactly when a browser will allow
    // the context to start.
    let cancelled = false
    void resumeAudio().then(() => {
      if (!cancelled) setLevel(1)
    })
    return () => {
      cancelled = true
    }
  }, [muted])

  useFrame(() => {
    if (muted) return
    const s = cinematicSample
    updateAudio({
      night: worldNight.value,
      disturbance: s.disturbance,
      power: s.power,
      ignition: s.ignition,
      shockwave: s.shockwave,
      blackout: s.blackout,
    })
  })

  return null
}
