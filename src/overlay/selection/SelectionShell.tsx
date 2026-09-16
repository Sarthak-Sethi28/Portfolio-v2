'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useScene } from '@/store/scene'
import { SECTIONS, SECTION_LABEL, type SectionId } from '@/content'
import { CONFIG_DEFAULTS } from '@/store/scene'
import { sectionRing } from '@/world/geometry/layout'
import { panelSideFor } from '@/world/selection/selectionState'

/**
 * Where a section's column stands, in world x.
 *
 * Computed from the same layout function the scene uses rather than hard-coded
 * here, so moving a column moves its panel with it.
 */
const RING = sectionRing(SECTIONS.length, CONFIG_DEFAULTS.arraySpacing)
function sectionX(section: SectionId): number {
  const i = SECTIONS.indexOf(section)
  return i >= 0 ? RING[i].position[0] : 0
}

/**
 * The frame every selected pillar's content grows inside.
 *
 * Deliberately knows nothing about experience, contact or writing. It owns the
 * things that must be identical whichever column you chose — where the panel
 * sits, how it enters, the three ways out, and the fact that the world stays
 * visible behind it — so that adding CONTACT later is a matter of passing
 * different children, not of building a second panel that almost matches.
 *
 * It is NOT a modal. There is no scrim over the scene and no focus trap that
 * would make the world feel switched off: the column you clicked is the subject
 * and this is an annotation beside it.
 */
export function SelectionShell({
  section,
  children,
}: {
  section: SectionId
  children: ReactNode
}) {
  const openSection = useScene((s) => s.openSection)
  const openSectionPanel = useScene((s) => s.openSectionPanel)
  const open = openSection === section

  const panel = useRef<HTMLDivElement>(null)

  /*
   * Escape, and a click on the world outside the panel.
   *
   * The third way out — clicking the raised column again — belongs to the
   * column itself and lives in ModelPier, because that one is a fact about the
   * 3D object rather than about this panel.
   *
   * The outside click is bound on pointerdown rather than click so that a drag
   * that starts on the scene and releases over the panel does not dismiss it.
   */
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') openSectionPanel(null)
    }
    const onDown = (e: PointerEvent) => {
      const el = panel.current
      if (el && e.target instanceof Node && el.contains(e.target)) return
      openSectionPanel(null)
    }

    window.addEventListener('keydown', onKey)
    // Deferred a frame: the very click that opened this would otherwise be the
    // same gesture that closes it.
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0)

    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open, openSectionPanel])

  /*
   * The panel takes the half of the screen the column does not.
   *
   * Pinning it to one side put the content directly over the object it
   * describes for two of the four columns. The side comes from the same world
   * x the camera reads, so the two cannot disagree.
   */
  const side = panelSideFor(sectionX(section))
  const left = side === 'left'

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-30 flex items-center ${
        left ? 'justify-start' : 'justify-end'
      }`}
      aria-hidden={!open}
    >
      <div
        ref={panel}
        role="dialog"
        aria-label={SECTION_LABEL[section]}
        className={`pointer-events-auto flex max-h-[82vh] w-[min(680px,52vw)] flex-col ${
          left ? 'ml-[4vw]' : 'mr-[4vw]'
        }`}
        style={{
          opacity: open ? 1 : 0,
          transform: `translate(${open ? 0 : left ? -14 : 14}px, ${open ? 0 : 14}px)`,
          // Restrained, as briefed — a few hundred milliseconds, and the panel
          // leaves faster than it arrives so dismissing never feels sticky.
          transition: open
            ? 'opacity 340ms ease-out 120ms, transform 340ms cubic-bezier(0.22,0.61,0.36,1) 120ms'
            : 'opacity 180ms ease-in, transform 180ms ease-in',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Shared surface treatment.
 *
 * Dark translucent graphite, one-pixel borders, glass. Exported so the contact
 * form's panel and the experience cards cannot drift apart into two house
 * styles.
 */
export const GLASS: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(14,17,21,0.82) 0%, rgba(9,11,14,0.88) 100%)',
  border: '1px solid rgba(233,230,222,0.10)',
  backdropFilter: 'blur(14px) saturate(1.1)',
  WebkitBackdropFilter: 'blur(14px) saturate(1.1)',
  boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
}

export const MONO: React.CSSProperties = {
  fontFamily: 'var(--font-mono), monospace',
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
}

/** The one accent in the world, used sparingly. */
export const ACCENT = 'rgba(196,42,28,0.92)'
