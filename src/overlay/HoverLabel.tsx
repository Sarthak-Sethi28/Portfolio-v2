'use client'

import { SECTION_LABEL, SECTION_LABEL_NIGHT, sectionNumber } from '@/content'
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
  const night = useScene((s) => s.night)

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
        className="select-none px-10 py-4 text-xs sm:text-sm"
        style={{
          fontFamily: 'var(--font-mono), monospace',
          letterSpacing: '0.42em',
          color: 'rgba(248,245,238,0.98)',
          /*
           * A pool of shade behind it, for the same reason as the legend.
           *
           * Wide-tracked type at 0.95 white still dissolved into the sea,
           * because the moving specular highlights sit in exactly that value
           * range. A gradient that fades to nothing at its edge gives the
           * letters a ground without putting a panel on top of the world.
           */
          background:
            'radial-gradient(56% 130% at 50% 50%, rgba(5,7,9,0.80) 0%, rgba(5,7,9,0.50) 44%, rgba(5,7,9,0.14) 74%, rgba(5,7,9,0) 100%)',
          textShadow: '0 1px 16px rgba(0,0,0,0.95)',
        }}
      >
        {/*
          Numbered, because the monuments are numbered: 01 / EXPERIENCE I.
          The digits sit back so the name is what reads at a glance, and the
          whole thing is gone the moment the pointer leaves — a permanent
          caption over a world like this would be a menu bar.
        */}
        {hovered && (
          <span className="inline-flex items-baseline gap-3">
            <span style={{ opacity: 0.5, fontSize: '0.78em' }}>{sectionNumber(hovered)}</span>
            <span aria-hidden style={{ opacity: 0.3, fontSize: '0.78em' }}>/</span>
            <span>{(night ? SECTION_LABEL_NIGHT : SECTION_LABEL)[hovered]}</span>
          </span>
        )}
      </div>
    </div>
  )
}
