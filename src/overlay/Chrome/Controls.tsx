'use client'

import { useEffect } from 'react'
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
        if (!portalFrame.measured) return

        // Night is now a real return journey, not a dead end.
        cinematicDirection.value = night || cinematic === 'complete' ? -1 : 1
        setCinematic('playing')
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleNight, toggleRain, setCinematic, cinematic, night])

  return null
}
