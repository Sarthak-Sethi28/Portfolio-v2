'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useScene } from '@/store/scene'
import { SECTIONS, SECTION_LABEL, SECTION_LABEL_NIGHT, sectionNumber, type SectionId } from '@/content'
import { CONFIG_DEFAULTS } from '@/store/scene'
import { sectionRing } from '@/world/geometry/layout'
import { panelSideFor } from '@/world/selection/selectionState'
import { GLASS, MONO, INK, INK_FAINT, useStagger } from './kit'

const RING = sectionRing(SECTIONS.length, CONFIG_DEFAULTS.arraySpacing)
function sectionX(section: SectionId): number {
  const i = SECTIONS.indexOf(section)
  return i >= 0 ? RING[i].position[0] : 0
}

/**
 * The frame every monument's content grows inside.
 *
 * It knows nothing about experience, Waterloo or contact. It owns the things
 * that must be identical whichever column you chose — where the panel sits, how
 * it arrives, the ways out, and the fact that the world stays visible behind it
 * — so each pillar supplies children rather than a fourth panel that almost
 * matches the other three.
 *
 * Not a modal: no scrim, no focus trap. The column is the subject; this is an
 * annotation beside it.
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
  const night = useScene((s) => s.night)
  const open = openSection === section
  const title = (night ? SECTION_LABEL_NIGHT : SECTION_LABEL)[section]

  const panel = useRef<HTMLDivElement>(null)

  /*
   * Escape, and a pointer anywhere that is not this panel.
   *
   * The second of those is the universal "back to the main view": the water,
   * the sky, the horizon, a scenery column — anything that is not the panel and
   * not the raised monument itself. Binding it here rather than putting a click
   * handler on the ocean mesh means it cannot be defeated by whatever the
   * pointer happens to land on, and it costs no raycasting.
   *
   * Bound on pointerdown so a drag that begins on the scene and releases over
   * the panel does not dismiss it; deferred one tick so the very click that
   * opened the panel is not also the one that closes it.
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
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0)

    return () => {
      window.clearTimeout(id)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open, openSectionPanel])

  /*
   * Narrow screens get the panel along the bottom instead of beside the column.
   *
   * Floating a card next to a monument needs horizontal room that a phone does
   * not have; squeezing it there leaves both the text and the world unreadable.
   * Below the breakpoint the panel takes the lower half and the world keeps the
   * upper half, which is the same idea expressed in the space available.
   */
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)')
    const sync = () => setNarrow(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const left = panelSideFor(sectionX(section)) === 'left'
  const header = useStagger(open, 0)

  return (
    <div
      className={
        narrow
          ? 'pointer-events-none fixed inset-0 z-30 flex items-end justify-center'
          : `pointer-events-none fixed inset-0 z-30 flex items-center ${
              left ? 'justify-start' : 'justify-end'
            }`
      }
      aria-hidden={!open}
    >
      <div
        ref={panel}
        role="dialog"
        aria-label={`${sectionNumber(section)} ${title}`}
        className={
          narrow
            ? 'pointer-events-auto mb-0 flex max-h-[58vh] w-full flex-col px-4 pb-4'
            : `pointer-events-auto flex max-h-[78vh] w-[min(620px,46vw)] flex-col ${
                left ? 'ml-[4vw]' : 'mr-[4vw]'
              }`
        }
        style={{
          opacity: open ? 1 : 0,
          transform: open
            ? 'translate(0,0)'
            : narrow
              ? 'translate(0, 16px)'
              : `translate(${left ? -12 : 12}px, 10px)`,
          transition: open
            ? 'opacity 200ms ease-out, transform 230ms cubic-bezier(0.22,0.61,0.36,1)'
            : 'opacity 130ms ease-in, transform 130ms ease-in',
          visibility: open ? 'visible' : 'hidden',
        }}
      >
        <header className="mb-3 flex items-baseline gap-3 px-1" style={header}>
          <span
            className="text-[10px]"
            style={{ ...MONO, letterSpacing: '0.3em', color: INK_FAINT }}
          >
            {sectionNumber(section)}
          </span>
          <span aria-hidden style={{ color: INK_FAINT, fontSize: '10px' }}>
            /
          </span>
          <h2
            className="text-[10px]"
            style={{ ...MONO, letterSpacing: '0.3em', color: INK }}
          >
            {title}
          </h2>
        </header>

        <div
          className="flex min-h-0 flex-col gap-3 overflow-y-auto p-5"
          style={{ ...GLASS, overscrollBehavior: 'contain' }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
