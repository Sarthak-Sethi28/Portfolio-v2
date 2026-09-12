'use client'

import { useEffect } from 'react'
import { useScene } from '@/store/scene'

/**
 * Keyboard shortcuts for development. No visible controls.
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
 * The keys stay because building the arrival means looking at night and rain
 * constantly. They are undocumented on purpose.
 */
export function Controls() {
  const toggleNight = useScene((s) => s.toggleNight)
  const toggleRain = useScene((s) => s.toggleRain)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'n' || e.key === 'N') toggleNight()
      if (e.key === 'r' || e.key === 'R') toggleRain()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleNight, toggleRain])

  return null
}
