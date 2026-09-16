'use client'

import { useEffect, useState } from 'react'
import { useScene } from '@/store/scene'
import type { SectionId } from '@/content'
import type { Project } from '@/content/nightPillars'
import { SelectionShell } from './SelectionShell'
import { ProjectMediaViewer } from './ProjectMedia'
import { Card, Switcher, useStagger, MONO, INK, INK_DIM, INK_FAINT, ACCENT } from './kit'

/**
 * A night monument: two projects, one panel.
 *
 * The switcher swaps the project without touching the pillar or the camera —
 * the selection has already happened, and moving the world again to change a
 * tab would be the camera talking over the visitor.
 *
 * Media comes first and the reading comes under it. A project is understood by
 * being seen; the paragraph is there for whoever wants it after.
 */
export function ProjectsPanel({
  section,
  projects,
}: {
  section: SectionId
  projects: Project[]
}) {
  /*
   * Two separate calls, deliberately.
   *
   * Written as `useScene(a) === section && useScene(b)` this short-circuits —
   * and a hook that is skipped when the left side is false is a conditional
   * hook call, which breaks the rules of hooks the moment a panel closes.
   */
  const openSection = useScene((s) => s.openSection)
  const night = useScene((s) => s.night)
  const open = night && openSection === section

  const [projectId, setProjectId] = useState(projects[0].id)

  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => setProjectId(projects[0].id), 240)
    return () => window.clearTimeout(id)
  }, [open, projects])

  const project = projects.find((p) => p.id === projectId) ?? projects[0]

  const head = useStagger(open, 1)
  const body = useStagger(open, 2)

  return (
    <SelectionShell section={section}>
      <Switcher
        open={open}
        value={project.id}
        onChange={setProjectId}
        options={projects.map((p) => ({ id: p.id, label: p.name }))}
      />

      {/* MEDIA FIRST. */}
      <div style={head}>
        <ProjectMediaViewer project={project} open={open} />
      </div>

      <div style={body}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h3
            className="text-[17px]"
            style={{ ...MONO, letterSpacing: '0.1em', color: INK, textTransform: 'none' }}
          >
            {project.name}
          </h3>
          <span className="flex flex-wrap gap-x-3">
            {project.year && (
              <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: INK_FAINT }}>
                {project.year}
              </span>
            )}
            {project.category && (
              <span style={{ ...MONO, fontSize: '9px', letterSpacing: '0.2em', color: INK_FAINT }}>
                {project.category}
              </span>
            )}
          </span>
        </div>

        <p className="mt-1.5 text-[12.5px]" style={{ color: 'rgba(234,230,222,0.80)' }}>
          {project.descriptor}
        </p>

        {/*
          Separate badges, never one line.

          Two achievements sitting in one sentence read as one claim — the
          conditional offer would be taken as coming from YC, which is not
          something the project data says.
        */}
        {project.achievements.length > 0 && (
          <span className="mt-3 flex flex-wrap gap-2">
            {project.achievements.map((a) => (
              <span
                key={a}
                className="px-3 py-1.5"
                style={{
                  border: '1px solid rgba(233,230,222,0.16)',
                  ...MONO,
                  fontSize: '8px',
                  letterSpacing: '0.22em',
                  color: INK_DIM,
                }}
              >
                {a}
              </span>
            ))}
          </span>
        )}

        {project.award && (
          <p
            className="mt-3 inline-flex items-center gap-2.5 px-3 py-1.5"
            style={{
              border: `1px solid ${ACCENT}`,
              background: 'rgba(196,52,34,0.10)',
            }}
          >
            <span aria-hidden style={{ color: ACCENT, fontSize: '10px' }}>
              ★
            </span>
            <span style={{ ...MONO, fontSize: '8.5px', letterSpacing: '0.24em', color: INK }}>
              {project.award}
            </span>
            {project.awardNote && (
              <span
                style={{ ...MONO, fontSize: '8px', letterSpacing: '0.2em', color: INK_DIM }}
              >
                {project.awardNote}
              </span>
            )}
          </p>
        )}

        {/*
          The status badge belongs here as well as on the pending cover.

          A project can have media AND a status worth stating — GIM's render is
          a concept visualisation, not a photograph of a manufactured device,
          and that has to be said next to the name rather than only in the place
          used by projects that have no media at all.
        */}
        {project.status && (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className="px-3 py-1.5"
              style={{
                border: `1px solid ${ACCENT}`,
                background: 'rgba(196,52,34,0.10)',
                ...MONO,
                fontSize: '8px',
                letterSpacing: '0.24em',
                color: INK,
              }}
            >
              {project.status.label}
            </span>
            {project.status.note && (
              <span
                className="text-[10.5px]"
                style={{ color: INK_FAINT, textTransform: 'none' }}
              >
                {project.status.note}
              </span>
            )}
          </p>
        )}
      </div>

      {/* The product's own shape, where it has one worth drawing. */}
      {project.flow.length > 0 && (
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5" style={body}>
          {project.flow.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span
                className="px-2 py-1"
                style={{
                  ...MONO,
                  fontSize: '8px',
                  letterSpacing: '0.18em',
                  color: INK_DIM,
                  border: '1px solid rgba(233,230,222,0.08)',
                }}
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

      <p className="text-[12px] leading-relaxed" style={{ ...body, color: 'rgba(230,226,218,0.62)' }}>
        {project.description}
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {project.cards.map((card, i) => (
          <Card key={card.label} card={{ ...card, metric: false }} index={i} open={open} />
        ))}
      </div>

      {/*
        SKILLS / TECHNOLOGY, grouped.

        A named group with its members on one line is read in about two seconds.
        The same fifteen items as equal pills is a wall, and a wall gets skipped.
      */}
      {project.skills.length > 0 && (
        <div className="flex flex-col gap-2.5" style={body}>
          <span
            style={{ ...MONO, fontSize: '8.5px', letterSpacing: '0.3em', color: INK_FAINT }}
          >
            Skills / Technology
          </span>
          {project.skills.map((g) => (
            <div key={g.group} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
              <span
                className="shrink-0 sm:w-28"
                style={{ ...MONO, fontSize: '8px', letterSpacing: '0.22em', color: ACCENT }}
              >
                {g.group}
              </span>
              <span className="text-[11.5px]" style={{ color: 'rgba(232,228,220,0.72)' }}>
                {g.items.join('  ·  ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {(project.githubUrl || project.demoUrl) && (
        <div className="flex flex-wrap gap-2" style={body}>
          {project.githubUrl && <Link href={project.githubUrl} label="GitHub" />}
          {/* Only ever rendered where a real, reachable demo exists. */}
          {project.demoUrl && <Link href={project.demoUrl} label="Live" />}
        </div>
      )}
    </SelectionShell>
  )
}

function Link({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex items-center gap-2.5 px-4 py-2.5 transition-colors duration-200 hover:bg-[rgba(233,230,222,0.05)]"
      style={{
        border: '1px solid rgba(233,230,222,0.12)',
        ...MONO,
        fontSize: '9px',
        letterSpacing: '0.24em',
        color: INK,
      }}
    >
      {label}
      <span
        aria-hidden
        className="transition-transform duration-200 group-hover:translate-x-0.5"
        style={{ color: INK_DIM }}
      >
        ↗
      </span>
    </a>
  )
}
