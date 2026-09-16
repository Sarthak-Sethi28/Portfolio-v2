'use client'

import { useEffect, useRef, useState } from 'react'
import type { Project, ProjectMedia as Media } from '@/content/nightPillars'
import { MONO, INK, INK_DIM, INK_FAINT, ACCENT } from './kit'

/**
 * One media system for every project.
 *
 * A project with a two-minute film and a project with four scanned pages go
 * through exactly the same component — they differ only in what is in the
 * `media` array. That is the whole point: eight bespoke layouts would be eight
 * things to keep in step, and the one with the least attention would rot.
 *
 * Media leads. The hero is the first thing in the panel and the text sits under
 * it, because a project is understood by being seen.
 */
export function ProjectMediaViewer({ project, open }: { project: Project; open: boolean }) {
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [playing, setPlaying] = useState(true)
  const video = useRef<HTMLVideoElement>(null)

  /*
   * A different project means a different hero; never inherit the last one's.
   * Deferred through a timer like every other reset in the overlay, because a
   * synchronous setState in an effect body is a cascading render.
   */
  useEffect(() => {
    const id = window.setTimeout(() => {
      setIndex(0)
      setExpanded(false)
      setPlaying(true)
    }, 0)
    return () => window.clearTimeout(id)
  }, [project.id])

  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => setExpanded(false), 240)
    return () => window.clearTimeout(id)
  }, [open])

  // Escape leaves the expanded viewer before it reaches the panel, so the first
  // press closes the picture and the second closes the project.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      setExpanded(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [expanded])

  const hero: Media | null = project.media[index] ?? null

  if (!hero) return <PendingCover project={project} />

  const toggle = () => {
    const el = video.current
    if (!el) return
    if (el.paused) {
      void el.play()
      setPlaying(true)
    } else {
      el.pause()
      setPlaying(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="group relative w-full overflow-hidden"
        style={{
          aspectRatio: '16 / 9',
          background: '#05070a',
          border: '1px solid rgba(233,230,222,0.08)',
        }}
      >
        {hero.kind === 'video' ? (
          <>
            <video
              ref={video}
              key={hero.src}
              src={hero.src}
              poster={hero.poster}
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              className="h-full w-full object-cover"
            />
            {/* Restrained controls of our own. The browser's default bar is a
                grey slab with rounded buttons and it belongs to no design. */}
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? 'Pause' : 'Play'}
              className="absolute bottom-3 left-3 flex h-8 w-8 items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{
                border: '1px solid rgba(236,232,224,0.34)',
                background: 'rgba(5,7,9,0.6)',
                color: INK,
                fontSize: '10px',
              }}
            >
              {playing ? '❙❙' : '▶'}
            </button>
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element --
             project assets of unknown intrinsic size, served straight from
             /public; next/image would demand dimensions we do not have. */
          <img src={hero.src} alt={hero.label} className="h-full w-full object-cover" />
        )}

        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Expand"
          className="absolute bottom-3 right-3 px-2.5 py-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          style={{
            ...MONO,
            fontSize: '8.5px',
            letterSpacing: '0.24em',
            border: '1px solid rgba(236,232,224,0.34)',
            background: 'rgba(5,7,9,0.6)',
            color: INK,
          }}
        >
          Expand
        </button>
      </div>

      {project.media.length > 1 && (
        <ul className="flex gap-1.5 overflow-x-auto pb-1">
          {project.media.map((m, i) => (
            <li key={m.src} className="shrink-0">
              <button
                type="button"
                onClick={() => setIndex(i)}
                aria-label={m.label}
                className="relative block h-12 w-20 overflow-hidden"
                style={{
                  border: `1px solid ${i === index ? 'rgba(236,232,224,0.44)' : 'rgba(233,230,222,0.08)'}`,
                  opacity: i === index ? 1 : 0.55,
                  transition: 'opacity 200ms ease, border-color 200ms ease',
                  background: '#05070a',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
                <img
                  src={m.kind === 'video' ? (m.poster ?? '') : m.src}
                  alt=""
                  className="h-full w-full object-cover"
                />
                {m.kind === 'video' && (
                  <span
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ color: 'rgba(255,255,255,0.9)', fontSize: '10px', textShadow: '0 1px 6px #000' }}
                  >
                    ▶
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {expanded && (
        <ExpandedViewer media={hero} onClose={() => setExpanded(false)} />
      )}
    </div>
  )
}

/** Full-frame viewer. Still not opaque — the world stays behind it. */
function ExpandedViewer({ media, onClose }: { media: Media; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-[5vw]"
      style={{ background: 'rgba(3,5,7,0.86)' }}
      onPointerDown={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div
        className="relative max-h-full max-w-full"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {media.kind === 'video' ? (
          <video
            src={media.src}
            poster={media.poster}
            muted
            loop
            playsInline
            autoPlay
            controls
            className="max-h-[86vh] max-w-full"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- see above */
          <img src={media.src} alt={media.label} className="max-h-[86vh] max-w-full object-contain" />
        )}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-9 right-0 px-3 py-1.5"
          style={{
            ...MONO,
            fontSize: '9px',
            letterSpacing: '0.26em',
            color: INK_DIM,
            border: '1px solid rgba(236,232,224,0.22)',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}

/**
 * The cover for a project whose film has not been made yet.
 *
 * Deliberately a designed cover rather than a stand-in screenshot. Inventing an
 * interface for a real product is the one thing a portfolio must not do, and a
 * grey box with "image coming soon" is worse than saying it outright — so this
 * shows the product's actual shape, its flow, and states plainly that the film
 * is still to come.
 */
function PendingCover({ project }: { project: Project }) {
  return (
    <div
      className="relative flex w-full flex-col justify-between overflow-hidden p-6"
      style={{
        aspectRatio: '16 / 9',
        border: '1px solid rgba(233,230,222,0.10)',
        background:
          'radial-gradient(120% 140% at 15% 0%, rgba(38,44,54,0.95) 0%, rgba(10,13,17,0.98) 55%, rgba(6,8,11,1) 100%)',
      }}
    >
      {/* A quiet field of rules, so the cover has depth without depicting
          anything that does not exist. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgba(233,230,222,0.05) 0 1px, transparent 1px 46px)',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)',
          WebkitMaskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)',
        }}
      />

      <div className="relative">
        <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.34em', color: ACCENT }}>
          {project.category ?? 'Project'}
        </span>
        <h4
          className="mt-3 text-[22px] sm:text-[26px]"
          style={{ ...MONO, letterSpacing: '0.12em', color: INK, textTransform: 'none' }}
        >
          {project.name}
        </h4>
      </div>

      <div className="relative">
        {project.flow.length > 0 && (
          <ol className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {project.flow.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span
                  style={{ ...MONO, fontSize: '8.5px', letterSpacing: '0.2em', color: INK_DIM }}
                >
                  {step}
                </span>
                {i < project.flow.length - 1 && (
                  <span aria-hidden style={{ color: 'rgba(233,230,222,0.22)', fontSize: '9px' }}>
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
        <span style={{ ...MONO, fontSize: '8.5px', letterSpacing: '0.26em', color: INK_FAINT }}>
          Film in production
        </span>
      </div>
    </div>
  )
}
