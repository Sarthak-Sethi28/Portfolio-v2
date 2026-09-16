'use client'

import { useEffect, useState } from 'react'
import { useScene } from '@/store/scene'

/**
 * The one control that turns the world's sound on.
 *
 * Sound defaults to off, so this has to be findable — but a world like this
 * cannot carry a toolbar. It sits in the corner opposite the compass, at the
 * same weight as the rest of the type, and it is the only thing on screen that
 * says what it will do before you do it.
 *
 * Four bars that animate only while sound is on, because a static icon of a
 * speaker tells you nothing about whether anything is currently playing.
 */
export function SoundToggle() {
  const muted = useScene((s) => s.muted)
  const toggleMuted = useScene((s) => s.toggleMuted)
  const phase = useScene((s) => s.phase)
  const noUi = useScene((s) => s.flags.noUi)

  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (phase === 'booting') return
    const id = window.setTimeout(() => setReady(true), 2400)
    return () => window.clearTimeout(id)
  }, [phase])

  if (noUi) return null

  const on = !muted

  return (
    <button
      type="button"
      onClick={toggleMuted}
      aria-label={on ? 'Turn sound off' : 'Turn sound on'}
      aria-pressed={on}
      className="group fixed bottom-5 right-5 z-20 flex items-center gap-2.5 px-3 py-2"
      style={{
        opacity: ready ? 1 : 0,
        transition: 'opacity 700ms ease',
        pointerEvents: ready ? 'auto' : 'none',
        background:
          'radial-gradient(70% 140% at 50% 50%, rgba(5,7,9,0.72) 0%, rgba(5,7,9,0.32) 55%, rgba(5,7,9,0) 100%)',
      }}
    >
      <span aria-hidden className="flex h-3 items-end gap-[2px]">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            style={{
              display: 'block',
              width: 2,
              background: on ? 'rgba(244,241,234,0.92)' : 'rgba(238,234,226,0.38)',
              // At rest the bars are a flat, quiet glyph. Playing, they move —
              // each at its own rate, so it reads as level rather than as a
              // four-step loop.
              height: on ? undefined : 4,
              animation: on ? `sound-bar ${620 + i * 190}ms ease-in-out ${i * 90}ms infinite` : 'none',
              transition: 'background 240ms ease',
            }}
          />
        ))}
      </span>
      <span
        className="text-[8.5px]"
        style={{
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.26em',
          textTransform: 'uppercase',
          color: on ? 'rgba(242,238,230,0.86)' : 'rgba(238,234,226,0.46)',
          textShadow: '0 1px 12px rgba(0,0,0,0.9)',
          transition: 'color 240ms ease',
        }}
      >
        {on ? 'Sound on' : 'Sound'}
      </span>

      <style>{`
        @keyframes sound-bar {
          0%, 100% { height: 3px; }
          50%      { height: 12px; }
        }
      `}</style>
    </button>
  )
}
