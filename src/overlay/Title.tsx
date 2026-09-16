'use client'

import { profile } from '@/content'
import { useScene } from '@/store/scene'

/** Wide-tracked landscape title for the two held endpoints. */
export function Title() {
  const open = useScene((s) => s.openSection ?? s.openProject)
  const noUi = useScene((s) => s.flags.noUi)
  const night = useScene((s) => s.night)
  const cinematic = useScene((s) => s.cinematic)
  const seqFlag = useScene((s) => s.flags.seq)
  const arrivedTitle = useScene((s) => s.arrivedTitle)

  const travelling = cinematic === 'playing' || seqFlag !== null
  const returning = travelling && night
  const arrived = arrivedTitle || cinematic === 'complete' || (cinematic === 'idle' && night)

  /*
   * On a night -> day return, keep the word PROJECTS while it fades OUT.
   *
   * The previous implementation switched the letters to SARTHAK SETHI the
   * instant F was pressed but kept the long forward-departure delay. That is
   * the stray name visible across the night portal in the recording. Only swap
   * to the name after the tunnel has actually returned us to daylight.
   */
  const showProjectsWord = arrived || returning
  const letters = (showProjectsWord ? 'PROJECTS' : profile.name.toUpperCase()).split('')

  const opacity = open || noUi || (travelling && !arrivedTitle) ? 0 : 1

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      style={{
        opacity,
        transition: arrivedTitle
          ? 'opacity 340ms ease-out 300ms'
          : returning
            ? 'opacity 180ms ease-out'
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
