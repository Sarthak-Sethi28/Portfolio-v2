'use client'

import { useScene } from '@/store/scene'

/**
 * The legend: what this world does, in one row.
 *
 * The first version of this was grey text at 0.40 opacity floating directly on
 * the water, and it could not be read at all — moving specular highlights sit
 * in exactly the value range the type was using, so the letters dissolved into
 * the sea. Type over an animated surface needs its own ground, not a lower
 * opacity, and that is the whole difference here: a dark blurred plate, a
 * hairline, and text bright enough to survive whatever passes underneath it.
 *
 * It carries BOTH actions, because the monuments being clickable is the less
 * obvious of the two and was going unsaid entirely.
 */
export function TransitionHint() {
  const cinematic = useScene((s) => s.cinematic)
  const night = useScene((s) => s.night)
  const openSection = useScene((s) => s.openSection)
  const hovered = useScene((s) => s.hovered)
  const noUi = useScene((s) => s.flags.noUi)
  const seq = useScene((s) => s.flags.seq)
  const reducedMotion = useScene((s) => s.reducedMotion)

  /*
   * NO TIMER, AND NOTHING TO WAIT FOR.
   *
   * This has been late twice for two different reasons. First it waited for
   * every model and texture to load, which put it four to five seconds after a
   * reload. Then it waited on a JS timer, which cannot start until the bundle
   * has downloaded and React has hydrated — three seconds of a cold load, and
   * three.js is not a small bundle.
   *
   * So it waits for neither. The element is in the server-rendered HTML with
   * its entrance as a CSS animation, which means the browser starts it on first
   * paint: no JavaScript involved in getting it on screen. The boot cover is a
   * dark ground and the line reads perfectly well against it, so it is simply
   * already there by the time the water appears.
   */

  const visible =
    !noUi &&
    seq === null &&
    !reducedMotion &&
    cinematic !== 'playing' &&
    // One caption at a time. While the pointer is on a monument its name is
    // showing just above this, and two stacked lines of wide-tracked mono at
    // the bottom of the frame is a menu bar.
    !hovered &&
    // Gone once a monument is open: by then the visitor has worked out that
    // the world is interactive, and the legend would only be in the way.
    openSection === null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{
        bottom: '4.5%',
        // The entrance is the CSS animation; this transition only handles it
        // leaving and returning once JavaScript is running.
        animation: 'hint-in 520ms ease-out 200ms both',
        opacity: visible ? undefined : 0,
        transform: visible ? undefined : 'translateY(8px)',
        transition: 'opacity 260ms ease, transform 260ms ease',
      }}
      aria-hidden={!visible}
    >
      <div
        className="flex select-none items-center gap-4 px-10 py-5 sm:gap-5"
        style={{
          /*
           * A pool of shade, not a panel.
           *
           * The bordered plate was legible and it sat ON TOP of the world like
           * a dialog — a hard rectangle is the most un-oceanic shape there is.
           * A radial gradient with nothing at its edge gives the type exactly
           * the same ground to stand on and then dissolves into the water, so
           * the sea reads as continuous behind it. No backdrop blur either:
           * a blur has to stop somewhere, and wherever it stops is an edge.
           */
          background:
            'radial-gradient(60% 130% at 50% 50%, rgba(5,7,9,0.80) 0%, rgba(5,7,9,0.55) 42%, rgba(5,7,9,0.18) 72%, rgba(5,7,9,0) 100%)',
        }}
      >
        <Item>
          <Key>Click</Key>
          <span>a pillar to know more</span>
        </Item>

        <span aria-hidden style={{ color: 'rgba(233,230,222,0.18)' }}>
          |
        </span>

        <Item>
          <Key>F</Key>
          <span>{night ? 'to return' : 'for a surprise'}</span>
        </Item>
      </div>
    </div>
  )
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="flex items-center gap-2.5 text-[9.5px] sm:text-[10.5px]"
      style={{
        fontFamily: 'var(--font-mono), monospace',
        letterSpacing: '0.26em',
        textTransform: 'uppercase',
        color: 'rgba(242,238,230,0.88)',
        textShadow: '0 1px 14px rgba(0,0,0,0.95)',
      }}
    >
      {children}
    </span>
  )
}

/** A key or a verb, drawn as a thin outline so it reads as a thing you do. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center px-2 py-1"
      style={{
        border: '1px solid rgba(236,232,224,0.34)',
        color: 'rgba(248,245,238,0.98)',
        textShadow: '0 1px 12px rgba(0,0,0,0.9)',
        letterSpacing: '0.18em',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  )
}
