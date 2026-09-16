'use client'

import { useEffect, useState } from 'react'
import { useScene } from '@/store/scene'

/**
 * The UW CS webring.
 *
 * Carried over from the site this replaces, with the same ring and the same
 * membership — cs.uwatering.com identifies a member by the URL in the hash, so
 * this must stay sethisarthak.com even while the page is served from somewhere
 * else, or the ring cannot find its own member and the arrows walk off it.
 *
 * It sits opposite the sound toggle and at the same weight as everything else:
 * a webring is a small courtesy to the ring, not a badge to wear. It goes when
 * anything is happening — a raised monument, a crossing — for the same reason
 * the rest of the chrome does.
 */
const RING = 'https://cs.uwatering.com/#https://sethisarthak.com'

export function Webring() {
  const phase = useScene((s) => s.phase)
  const cinematic = useScene((s) => s.cinematic)
  const openSection = useScene((s) => s.openSection)
  const noUi = useScene((s) => s.flags.noUi)

  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (phase === 'booting') return
    const id = window.setTimeout(() => setReady(true), 2400)
    return () => window.clearTimeout(id)
  }, [phase])

  if (noUi) return null

  const visible = ready && cinematic !== 'playing' && openSection === null

  return (
    <nav
      aria-label="UW CS webring"
      className="fixed bottom-5 left-5 z-20 flex items-center gap-3 px-3 py-2"
      style={{
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 700ms ease',
        background:
          'radial-gradient(70% 140% at 50% 50%, rgba(5,7,9,0.72) 0%, rgba(5,7,9,0.32) 55%, rgba(5,7,9,0) 100%)',
      }}
    >
      <Arrow href={`${RING}?nav=prev`} label="Previous site in the UW CS webring">
        ←
      </Arrow>

      <a
        href={RING}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="UW CS webring"
        className="flex items-center"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- the ring's own
            mark, served from the ring. next/image would proxy someone else's
            asset through this site for no benefit. */}
        <img
          src="https://cs.uwatering.com/icon.white.svg"
          alt="UW CS Webring"
          width={18}
          height={18}
          className="h-[18px] w-auto transition-opacity duration-200"
          style={{ opacity: 0.55, filter: 'drop-shadow(0 1px 8px rgba(0,0,0,0.9))' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.55'
          }}
        />
      </a>

      <Arrow href={`${RING}?nav=next`} label="Next site in the UW CS webring">
        →
      </Arrow>
    </nav>
  )
}

function Arrow({
  href,
  label,
  children,
}: {
  href: string
  label: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      aria-label={label}
      className="text-[11px] transition-colors duration-200"
      style={{
        fontFamily: 'var(--font-mono), monospace',
        color: 'rgba(238,234,226,0.46)',
        textShadow: '0 1px 10px rgba(0,0,0,0.9)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'rgba(246,243,236,0.95)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'rgba(238,234,226,0.46)'
      }}
    >
      {children}
    </a>
  )
}
