'use client'

import { useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useScene } from '@/store/scene'
import { advanceCinematic, cinematicClock, resetCinematic, DURATION } from './cinematicState'

/**
 * Advances the one clock, and nothing else.
 *
 * Mounted FIRST inside the scene so its frame callback runs before every
 * consumer's — R3F runs same-priority subscriptions in mount order, so the
 * sample is always written before anything reads it. A non-zero renderPriority
 * would guarantee ordering too, but it also hands the render loop over to the
 * caller, which is a much larger change than this needs.
 *
 * The only writes to React state here are the three transitions of a coarse
 * status. Everything continuous lives in the mutable clock.
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
      /*
       * Reduced motion gets the destination, not the journey.
       *
       * Fifteen seconds of collapsing sky, fleeing birds and sinking towers is
       * exactly the kind of thing the setting exists to refuse. It is not
       * served by playing the same piece faster — that is more motion per
       * second, not less — so the world simply arrives at night.
       */
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
    // Guard against a hitch producing a huge step. A tab restored after a
    // minute in the background reports a minute of delta, which would jump the
    // whole piece in one frame.
    advanceCinematic(Math.min(delta, 1 / 20))

    /*
     * Swap the title's word while nobody can see it.
     *
     * This is a React state write inside a frame loop, which is normally the
     * thing to avoid — but it happens exactly ONCE, at a moment when the
     * blackout veil is fully opaque, so the render it causes is invisible and
     * there is no per-frame cost. The alternative, rendering both words and
     * cross-fading them, would put the destination's name on screen during the
     * journey with only an opacity between it and the viewer.
     */
    const t = cinematicClock.elapsed
    if (!arrivedTitle && t >= 14.72) setArrivedTitle(true)
    else if (arrivedTitle && t < 14.5 && cinematicClock.scrub !== null) setArrivedTitle(false)

    if (cinematicClock.running && cinematicClock.elapsed >= DURATION) {
      cinematicClock.running = false
      /*
       * Hand over to the stable night scene.
       *
       * The store's night flag becomes true at exactly the moment the timeline
       * reaches its own full night, so the value handed over is the value
       * already on screen and the swap is invisible.
       */
      setNight(true)
      setCinematic('complete')
    }
  })

  return null
}
