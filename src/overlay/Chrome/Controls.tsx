'use client'

import { useEffect } from 'react'
import { useScene } from '@/store/scene'

/**
 * The scene controls, top right.
 *
 * Deliberately quiet: hairline type, no chrome, no panel. This is a world
 * first and an interface second, so the controls should be findable and
 * otherwise invisible — the moment they look like a toolbar the illusion that
 * you are standing somewhere is gone.
 *
 * Day/night is a real toggle, not a preset swap: the palette blends
 * continuously in the frame loop, so holding the transition mid-way gives a
 * dusk that is neither state. That is worth having and worth not hiding.
 */
export function Controls() {
  const toggleNight = useScene((s) => s.toggleNight)
  const rain = useScene((s) => s.rain)
  const toggleRain = useScene((s) => s.toggleRain)
  const open = useScene((s) => s.openSection ?? s.openProject)

  // N and R, because reaching for a keyboard is faster than finding a button
  // and anyone who plays with this will try single letters.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // Development only: there is no night control in the interface.
      if (e.key === 'n' || e.key === 'N') toggleNight()
      if (e.key === 'r' || e.key === 'R') toggleRain()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleNight, toggleRain])

  const label = {
    fontFamily: 'var(--font-mono), monospace',
    letterSpacing: '0.26em',
    fontSize: 11,
    textTransform: 'uppercase' as const,
  }

  return (
    <div
      className="absolute right-5 top-5 z-30 flex flex-col items-end gap-2"
      style={{
        opacity: open ? 0 : 1,
        transition: 'opacity 500ms ease',
        pointerEvents: open ? 'none' : 'auto',
      }}
    >
      {/*
        NO day/night toggle.

        Night is not a mode, it is where the gate takes you. A control that
        flips it spends the reveal before the visitor has earned it — they
        find the setting in the first five seconds and arriving at night later
        is no longer a reveal, just a preference they already changed.

        It also fixes what we could not get right: night was being judged from
        the DAY camera in the DAY composition, and failing, because that shot
        is staged for a low sun. As an arrival it gets its own framing, and
        stops being the same picture with the lights down.

        The N key survives for development — see the handler above — because
        building the arrival means looking at night constantly.
      */}

      <button
        onClick={toggleRain}
        aria-pressed={rain}
        className="cursor-pointer select-none border-0 bg-transparent px-1 py-1"
        style={{
          ...label,
          color: rain ? 'rgba(250,246,238,0.9)' : 'rgba(250,246,238,0.42)',
          textShadow: '0 1px 10px rgba(0,0,0,0.75)',
        }}
      >
        rain
      </button>

      <span
        style={{
          ...label,
          fontSize: 9,
          letterSpacing: '0.2em',
          color: 'rgba(250,246,238,0.3)',
          textShadow: '0 1px 8px rgba(0,0,0,0.7)',
        }}
      >
        n · r
      </span>
    </div>
  )
}
