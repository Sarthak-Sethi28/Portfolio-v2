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
  const cinematic = useScene((s) => s.cinematic)
  const seqFlag = useScene((s) => s.flags.seq)
  // Scrubbing counts as travelling, for the same reason Stage does it.
  const travelling = cinematic === 'playing' || seqFlag !== null
  
  /*
   * PROJECTS belongs to the destination, not to the night value.
   *
   * Switching on `night` alone would print the word the instant the sky
   * finished turning — around eleven seconds, with three seconds of journey
   * still to run and the visitor not yet through the portal. The word is the
   * arrival announcing itself, so it waits for the arrival.
   */
  const arrivedTitle = useScene((s) => s.arrivedTitle)
  const arrived = arrivedTitle || cinematic === 'complete' || (cinematic === 'idle' && night)
  const letters = (arrived ? 'PROJECTS' : profile.name.toUpperCase()).split('')

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      style={{
        opacity: open || noUi || (travelling && !arrivedTitle) ? 0 : 1,
        /*
         * The name leaves between 2.8 and 4.0 seconds, expressed as a CSS
         * delay rather than as a timer or a per-frame opacity.
         *
         * A setTimeout would be a second clock that can drift from the master
         * one and keeps running if the cinematic is interrupted; driving
         * opacity from the frame loop would mean a React render per frame for
         * a DOM node that changes once. The transition starts when the status
         * flips to playing and the browser owns the interpolation from there.
         */
        /*
         * Three behaviours, no timers.
         *
         * Leaving: a delayed CSS transition so the name clears between 2.8 and
         * 4.0 seconds without a setTimeout that could drift from the master
         * clock or outlive an interrupted run.
         *
         * Arriving: the word has already been swapped under full black, so
         * this only has to bring it up over the last third of a second as the
         * veil clears — first readable around 14.65, settled by 15.0.
         */
        transition: arrivedTitle
          ? 'opacity 340ms ease-out 300ms'
          : travelling
            ? 'opacity 1200ms ease-in-out 2800ms'
            : 'opacity 700ms ease-in-out',
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
