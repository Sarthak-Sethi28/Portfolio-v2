'use client'

import { profile } from '@/content'
import { useScene } from '@/store/scene'

/**
 * The name, centred over the world.
 *
 * Letter-spaced far wider than type is normally set. At this tracking the name
 * stops reading as a word and starts reading as signage on the landscape,
 * which is the point. Each glyph is its own span so it can be animated
 * individually during the reveal.
 */
export function Title() {
  const open = useScene((s) => s.openSection ?? s.openProject)
  const letters = profile.name.toUpperCase().split('')

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      style={{ opacity: open ? 0 : 1, transition: 'opacity 700ms ease-in-out' }}
    >
      <h1
        className="select-none px-4 text-center text-lg sm:text-2xl md:text-3xl"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 300,
          letterSpacing: 'clamp(10px, 3.6vw, 34px)',
          paddingLeft: 'clamp(10px, 3.6vw, 34px)',
          color: 'rgba(12,14,16,0.92)',
          textShadow: '0 1px 30px rgba(255,255,255,0.25)',
        }}
      >
        {letters.map((ch, i) => (
          <span
            key={i}
            style={{ display: 'inline-block', minWidth: ch === ' ' ? '0.5em' : undefined }}
          >
            {ch === ' ' ? ' ' : ch}
          </span>
        ))}
      </h1>
    </div>
  )
}
