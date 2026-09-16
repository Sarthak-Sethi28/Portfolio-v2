'use client'

import { useEffect, useState } from 'react'
import { useScene } from '@/store/scene'

/**
 * The quietest possible instruction.
 *
 * There is a portal in the middle of the frame and no way to know it does
 * anything, which is the one piece of information this world genuinely cannot
 * convey by itself. So: grey, small, wide-tracked, sitting under everything
 * else, and gone the moment the visitor is doing something.
 *
 * It arrives late on purpose. Coming up with the title would make the first
 * impression a caption with a keyboard shortcut in it; a few seconds later the
 * scene has already been looked at, and the hint reads as an offer rather than
 * an instruction.
 */
export function TransitionHint() {
  const phase = useScene((s) => s.phase)
  const cinematic = useScene((s) => s.cinematic)
  const night = useScene((s) => s.night)
  const hovered = useScene((s) => s.hovered)
  const openSection = useScene((s) => s.openSection)
  const noUi = useScene((s) => s.flags.noUi)
  const seq = useScene((s) => s.flags.seq)
  const reducedMotion = useScene((s) => s.reducedMotion)

  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (phase === 'booting') return
    const id = window.setTimeout(() => setReady(true), 2600)
    return () => window.clearTimeout(id)
  }, [phase])

  const visible =
    ready &&
    !noUi &&
    seq === null &&
    !reducedMotion &&
    cinematic !== 'playing' &&
    // Never two pieces of text competing for the bottom of the frame, and
    // nothing at all while a monument is open — at that point the visitor has
    // plainly worked out that the world is interactive.
    !hovered &&
    openSection === null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-10 flex justify-center"
      style={{
        bottom: '5.5%',
        opacity: visible ? 1 : 0,
        transform: `translateY(${visible ? 0 : 6}px)`,
        transition: 'opacity 900ms ease, transform 900ms ease',
      }}
      aria-hidden={!visible}
    >
      <p
        className="flex select-none items-center gap-3 text-[9px] sm:text-[10px]"
        style={{
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.34em',
          textTransform: 'uppercase',
          color: 'rgba(236,232,224,0.40)',
          textShadow: '0 1px 18px rgba(0,0,0,0.85)',
        }}
      >
        <span>Press</span>
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: '1.9em',
            height: '1.9em',
            border: '1px solid rgba(236,232,224,0.28)',
            color: 'rgba(240,236,228,0.72)',
            letterSpacing: 0,
          }}
        >
          F
        </span>
        <span>{night ? 'to return' : 'to cross'}</span>
      </p>
    </div>
  )
}
