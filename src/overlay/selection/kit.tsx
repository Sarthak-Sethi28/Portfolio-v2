'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { PillarCard } from '@/content'

/**
 * The house style, in one place.
 *
 * Every pillar's content is built from these, so the experience boxes, the
 * Waterloo tiles and the contact form cannot drift into three different designs
 * that each look nearly right.
 */

export const GLASS: CSSProperties = {
  background: 'linear-gradient(180deg, rgba(13,16,20,0.78) 0%, rgba(8,10,13,0.86) 100%)',
  border: '1px solid rgba(233,230,222,0.09)',
  backdropFilter: 'blur(16px) saturate(1.08)',
  WebkitBackdropFilter: 'blur(16px) saturate(1.08)',
}

export const MONO: CSSProperties = {
  fontFamily: 'var(--font-mono), monospace',
  textTransform: 'uppercase',
}

export const ACCENT = 'rgba(196,52,34,0.9)'
export const INK = 'rgba(244,241,234,0.94)'
export const INK_DIM = 'rgba(238,234,226,0.56)'
export const INK_FAINT = 'rgba(238,234,226,0.34)'

/** A small uppercase section label. */
export function Label({ children, tone = INK_FAINT }: { children: ReactNode; tone?: string }) {
  return (
    <span
      className="block text-[9px]"
      style={{ ...MONO, letterSpacing: '0.34em', color: tone }}
    >
      {children}
    </span>
  )
}

/**
 * Staggered entrance.
 *
 * One hook rather than four animation systems: anything that should arrive with
 * the panel asks for its place in the queue and gets the same small rise and
 * fade, offset by a fixed step. Restrained on purpose — 18ms apart reads as one
 * considered movement, 120ms apart reads as a slideshow.
 */
export function useStagger(open: boolean, index: number, step = 34): CSSProperties {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Both directions go through a timer. Resetting synchronously on close is a
    // setState in an effect body, which the compiler rules rightly flag as a
    // cascading render — and the exit transition wants a frame to play out
    // anyway, so deferring costs nothing.
    const id = window.setTimeout(
      () => setShown(open),
      open ? 90 + index * step : 0,
    )
    return () => window.clearTimeout(id)
  }, [open, index, step])

  return {
    opacity: shown ? 1 : 0,
    transform: `translateY(${shown ? 0 : 9}px)`,
    transition: 'opacity 300ms ease-out, transform 300ms cubic-bezier(0.22,0.61,0.36,1)',
  }
}

/**
 * One content box.
 *
 * Label, headline, and then the sentence that used to be folded away. The fold
 * was a bet that people click to read more, and they do not — so the substance
 * is here, in the first thing they look at. `metric` promotes the headline to
 * the thing readable from across the room.
 */
export function Card({
  card,
  index,
  open,
}: {
  card: PillarCard
  index: number
  open: boolean
}) {
  const enter = useStagger(open, index + 2)

  return (
    <article
      className="flex flex-col px-4 py-3.5"
      style={{
        ...enter,
        background: 'rgba(233,230,222,0.028)',
        border: '1px solid rgba(233,230,222,0.07)',
      }}
    >
      <Label tone={card.metric ? ACCENT : INK_FAINT}>{card.label}</Label>
      <p
        className={card.metric ? 'mt-2 text-[15px]' : 'mt-2 text-[12.5px]'}
        style={{
          color: card.metric ? INK : 'rgba(234,230,222,0.82)',
          letterSpacing: card.metric ? '0.02em' : 0,
          lineHeight: 1.4,
          fontFamily: card.metric ? 'var(--font-mono), monospace' : undefined,
        }}
      >
        {card.value}
      </p>
      {card.note && (
        <p
          className="mt-2 text-[11.5px] leading-[1.55]"
          style={{ color: 'rgba(230,226,218,0.56)' }}
        >
          {card.note}
        </p>
      )}
    </article>
  )
}

/** Small tags, for coursework and stacks. */
export function Tags({ items, open, from = 6 }: { items: string[]; open: boolean; from?: number }) {
  const enter = useStagger(open, from)
  if (items.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-1.5" style={enter}>
      {items.map((s) => (
        <li
          key={s}
          className="px-2.5 py-1 text-[9px]"
          style={{
            ...MONO,
            letterSpacing: '0.18em',
            color: INK_DIM,
            border: '1px solid rgba(233,230,222,0.08)',
            background: 'rgba(233,230,222,0.02)',
          }}
        >
          {s}
        </li>
      ))}
    </ul>
  )
}

/** The company / segment switcher: [ VOLARIS ] [ DANIER ]. */
export function Switcher({
  options,
  value,
  onChange,
  open,
}: {
  options: { id: string; label: string }[]
  value: string
  onChange: (id: string) => void
  open: boolean
}) {
  const enter = useStagger(open, 1)
  if (options.length < 2) return null

  return (
    <div className="flex flex-wrap gap-2" style={enter}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className="px-3.5 py-2 text-[9.5px]"
            style={{
              ...MONO,
              letterSpacing: '0.24em',
              color: active ? INK : INK_FAINT,
              border: `1px solid ${active ? 'rgba(233,230,222,0.22)' : 'rgba(233,230,222,0.07)'}`,
              background: active ? 'rgba(233,230,222,0.05)' : 'transparent',
              transition: 'color 200ms ease, border-color 200ms ease, background 200ms ease',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
