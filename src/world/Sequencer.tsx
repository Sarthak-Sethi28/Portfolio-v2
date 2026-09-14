'use client'

import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'

/** Seconds from the wide arrival to standing in the night world. */
const DURATION = 15

/**
 * Plays the arrival.
 *
 * Advances the one clock everything else reads. It holds no opinion about what
 * any beat looks like — the timeline in sequence.ts owns that — so the only
 * thing that can go wrong here is the speed.
 *
 * It writes to the store at about twenty steps rather than every frame. The
 * store is React state, so a write is a render of every subscriber, and
 * pushing a fresh float sixty times a second re-rendered the entire world
 * tree for a change too small to see. The frame loop reads the smooth value
 * directly; only render-scope consumers need the stepped one.
 *
 * ENDING. At the end it sets `night`, so the world stays where the sequence
 * left it, and returns the clock to zero. That matters because the sequence
 * is a journey and the night scene is a PLACE: once you have arrived, nothing
 * should still be holding you at the last frame of the trip.
 */
export function Sequencer() {
  const playing = useScene((s) => s.playing)
  const setSequence = useScene((s) => s.setSequence)
  const setPlaying = useScene((s) => s.setPlaying)
  const toggleNight = useScene((s) => s.toggleNight)
  const night = useScene((s) => s.night)
  const seqFlag = useScene((s) => s.flags.seq)

  const t = useRef(0)
  const pushed = useRef(-1)

  useEffect(() => {
    if (playing) t.current = 0
  }, [playing])

  useFrame((_, delta) => {
    // A scrub is authoritative; nothing may advance the clock behind it.
    if (seqFlag !== null || !playing) return

    t.current = Math.min(1, t.current + delta / DURATION)

    const stepped = Math.round(t.current * 20) / 20
    if (stepped !== pushed.current) {
      pushed.current = stepped
      setSequence(stepped)
    }

    if (t.current >= 1) {
      if (!night) toggleNight()
      setPlaying(false)
      setSequence(0)
      pushed.current = -1
    }
  })

  return null
}
