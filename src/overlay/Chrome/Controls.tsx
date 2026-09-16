'use client'

import { useEffect, useRef } from 'react'
import { useScene } from '@/store/scene'
import {
  cinematicDirection,
  portalFrame,
} from '@/world/cinematic/cinematicState'

/**
 * Keyboard input. No visible controls.
 *
 * F is the journey trigger in BOTH directions:
 * - from day, it runs day -> night
 * - from the completed night destination, it runs night -> day
 *
 * Mid-flight reversal is intentionally blocked. Every visual system samples one
 * deterministic clock, so the user always completes the current trip before a
 * new one can begin.
 */
export function Controls() {
  const toggleNight = useScene((s) => s.toggleNight)
  const toggleRain = useScene((s) => s.toggleRain)
  const setCinematic = useScene((s) => s.setCinematic)
  const cinematic = useScene((s) => s.cinematic)
  const night = useScene((s) => s.night)

  /*
   * A press made before the world can answer is REMEMBERED, not dropped.
   *
   * The legend now appears while the world is still assembling — that is the
   * point of it appearing early — which means somebody can read "press F" and
   * press it before the portal has been measured. Returning early there makes
   * the key look broken, and a visitor who presses a key and gets nothing does
   * not usually press it twice.
   */
  const pending = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'n' || e.key === 'N') toggleNight()
      if (e.key === 'r' || e.key === 'R') toggleRain()

      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        if (cinematic === 'playing') return
        if (!portalFrame.measured) {
          pending.current = true
          return
        }

        // Night is now a real return journey, not a dead end.
        cinematicDirection.value = night || cinematic === 'complete' ? -1 : 1
        setCinematic('playing')
      }
    }

    window.addEventListener('keydown', onKey)

    /*
     * Redeem an early press the moment the portal exists.
     *
     * A short poll rather than a subscription, because `portalFrame.measured`
     * is a plain mutable flag written by the scene — nothing to subscribe to —
     * and it stops as soon as it has fired.
     */
    const id = window.setInterval(() => {
      if (!pending.current || !portalFrame.measured || cinematic === 'playing') return
      pending.current = false
      cinematicDirection.value = night || cinematic === 'complete' ? -1 : 1
      setCinematic('playing')
    }, 120)

    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(id)
    }
  }, [toggleNight, toggleRain, setCinematic, cinematic, night])

  return null
}
