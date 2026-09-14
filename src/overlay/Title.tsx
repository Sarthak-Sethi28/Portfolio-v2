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
  const noUi = useScene((s) => s.flags.noUi)
  /*
   * The arrival is titled PROJECTS, not the name.
   *
   * The front door announces who this is; the world through the gate
   * announces what is IN it. Carrying the name through would say the visitor
   * has changed setting, where the point is that they have arrived somewhere —
   * and the same wide-tracked type on a different word is what tells them so.
   */
  const night = useScene((s) => s.night)
  /*
   * The type clears out for the journey.
   *
   * It sat over every beat of the arrival — the columns going under, the lock
   * turning, the flight down the throat — where it read as a watermark stuck
   * to the lens rather than as signage on a landscape. A title belongs to a
   * held shot. Once the world starts moving it has nothing to label, and by
   * the tunnel it was literally printed across the vanishing point.
   *
   * So it leaves as soon as the sequence starts and returns on the far side,
   * by which time the word underneath it has changed.
   */
  const sequence = useScene((s) => s.sequence)
  const travelling = sequence > 0.001 && sequence < 0.999
  const letters = (night ? 'PROJECTS' : profile.name.toUpperCase()).split('')

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      style={{
        opacity: open || noUi || travelling ? 0 : 1,
        transition: 'opacity 700ms ease-in-out',
      }}
    >
      <h1
        className="select-none px-4 text-center text-lg sm:text-2xl md:text-3xl"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 300,
          letterSpacing: 'clamp(10px, 3.6vw, 34px)',
          paddingLeft: 'clamp(10px, 3.6vw, 34px)',
          color: 'rgba(244,241,234,0.94)',
          // A tighter shadow. 90px of blur on text composited over an
          // animating canvas forces a large repaint region every frame, which
          // some compositors handle badly.
          textShadow: '0 1px 14px rgba(0,0,0,0.9)',
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
