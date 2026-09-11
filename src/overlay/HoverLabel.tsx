'use client'

import { SECTION_LABEL } from '@/content'
import { useScene } from '@/store/scene'

/**
 * The label for whichever monolith is under the pointer.
 *
 * Until now hovering a slab changed its roughness by a fraction and nothing
 * else, which is indistinguishable from nothing at all — the site looked
 * inert. A world you can click has to SAY so before you click it.
 *
 * Rendered in the DOM rather than in the scene so it is real selectable text
 * that a screen reader can announce, and so it stays crisp at any distance.
 */
export function HoverLabel() {
  const hovered = useScene((s) => s.hovered)
  const open = useScene((s) => s.openSection ?? s.openProject)

  const visible = Boolean(hovered) && !open

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-20 flex justify-center"
      style={{
        bottom: '14%',
        opacity: visible ? 1 : 0,
        transform: `translateY(${visible ? 0 : 8}px)`,
        transition: 'opacity 320ms ease, transform 320ms ease',
      }}
      aria-live="polite"
    >
      <div
        className="select-none px-5 py-2 text-xs sm:text-sm"
        style={{
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.42em',
          color: 'rgba(242,239,232,0.95)',
          textShadow: '0 2px 26px rgba(0,0,0,0.9)',
          borderBottom: '1px solid rgba(242,239,232,0.35)',
        }}
      >
        {hovered ? SECTION_LABEL[hovered] : ''}
      </div>
    </div>
  )
}
