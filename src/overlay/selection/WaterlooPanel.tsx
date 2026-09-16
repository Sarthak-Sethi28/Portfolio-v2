'use client'

import { useEffect, useState } from 'react'
import { useScene } from '@/store/scene'
import { coursework, education, leadership } from '@/content'
import { SelectionShell } from './SelectionShell'
import { Card, Label, Switcher, Tags, useStagger, MONO, INK, INK_DIM, INK_FAINT } from './kit'

type Segment = 'education' | 'coursework' | 'leadership'

/**
 * 03 — WATERLOO. Three things that belong to one place.
 *
 * Education, coursework and the Deal Group are different KINDS of fact, so they
 * get the same switcher the experience pillars use rather than being stacked
 * into one long scroll. Coursework in particular is deliberately not the
 * dominant view: it is a compact field of tags behind its own tab, because a
 * grid of course names is context, not an achievement.
 */
export function WaterlooPanel() {
  const open = useScene((s) => s.openSection) === 'waterloo'
  const [segment, setSegment] = useState<Segment>('education')

  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => setSegment('education'), 240)
    return () => window.clearTimeout(id)
  }, [open])

  const meta = useStagger(open, 1)
  const role = leadership.roles[0]

  return (
    <SelectionShell section="waterloo">
      <Switcher
        open={open}
        value={segment}
        onChange={(id) => setSegment(id as Segment)}
        options={[
          { id: 'education', label: 'Education' },
          { id: 'coursework', label: 'Coursework' },
          { id: 'leadership', label: 'Leadership' },
        ]}
      />

      {segment === 'education' && (
        <>
          <div style={meta}>
            <h3 className="text-[15px]" style={{ ...MONO, letterSpacing: '0.16em', color: INK }}>
              {education.school}
            </h3>
            <p className="mt-2 text-[12.5px]" style={{ color: 'rgba(234,230,222,0.78)' }}>
              {education.degree}
            </p>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-[9px]" style={{ ...MONO, letterSpacing: '0.2em', color: INK_DIM }}>
                {education.period}
              </span>
              <span className="text-[9px]" style={{ ...MONO, letterSpacing: '0.2em', color: INK_FAINT }}>
                {education.where}
              </span>
            </p>
          </div>

          {/*
            No cards under Education.

            There were two: a count of the courses sitting one tab away, which
            said nothing about any of them, and a Degree tile that repeated the
            line directly above it word for word. The heading already carries
            the school, the degree, the years and the place — everything a card
            here could have said.
          */}
        </>
      )}

      {segment === 'coursework' && (
        <div className="flex flex-col gap-3" style={meta}>
          <Label>Relevant coursework</Label>
          <Tags items={coursework} open={open} from={2} />
        </div>
      )}

      {segment === 'leadership' && (
        <>
          <div style={meta}>
            <h3 className="text-[15px]" style={{ ...MONO, letterSpacing: '0.16em', color: INK }}>
              {leadership.name}
            </h3>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-[9px]" style={{ ...MONO, letterSpacing: '0.2em', color: INK_DIM }}>
                {role.period}
              </span>
              <span className="text-[9px]" style={{ ...MONO, letterSpacing: '0.2em', color: INK_FAINT }}>
                {leadership.where}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {role.cards.map((card, i) => (
              <Card key={card.label} card={card} index={i} open={open} />
            ))}
          </div>

        </>
      )}
    </SelectionShell>
  )
}
