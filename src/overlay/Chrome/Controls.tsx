'use client'

import { useEffect } from 'react'
import { useScene } from '@/store/scene'

/**
 * Keyboard input. No visible controls.
 *
 * There is deliberately nothing on screen.
 *
 * Night was a toggle and is not any more: night is where the gate TAKES you,
 * and a control that flips it spends the reveal before the visitor has earned
 * it. Rain followed it out — a weather switch is a toy, and a toy in the
 * corner tells the viewer they are looking at a demo rather than standing
 * somewhere. Jace's site can carry a SYS.CONFIG panel because his whole
 * framing is a machine you are operating; ours is a place.
 *
 * N and R stay because building the arrival means looking at night and rain
 * constantly, and they are undocumented on purpose.
 *
 * F is different in kind: it plays the arrival, which is the one thing the
 * visitor is actually meant to do here. It is on a key rather than a button
 * for now, but it is not a debug shortcut — when this gets its real trigger,
 * this is the call it makes.
 */
export function Controls() {
  const toggleNight = useScene((s) => s.toggleNight)
  const toggleRain = useScene((s) => s.toggleRain)
  const setCinematic = useScene((s) => s.setCinematic)
  const cinematic = useScene((s) => s.cinematic)
  const night = useScene((s) => s.night)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'n' || e.key === 'N') toggleNight()
      if (e.key === 'r' || e.key === 'R') toggleRain()
      /*
       * F plays the arrival.
       *
       * It always starts from the day side, because the sequence IS the
       * journey from day to night — running it while already at night would
       * play fifteen seconds of a world changing into what it already is. So
       * pressing it at night rewinds to day first and goes again.
       */
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        /*
         * Once, from the day side, and not interruptible.
         *
         * Restarting or reversing mid-transition would put the world in a
         * state no beat describes — pillars half-sunk while the sky runs
         * backwards — and every system here derives its value from one clock
         * on the assumption that the clock only moves forward through a piece
         * that was authored in one direction.
         */
        if (cinematic !== 'idle' || night) return
        setCinematic('playing')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleNight, toggleRain, setCinematic, cinematic, night])

  return null
}
