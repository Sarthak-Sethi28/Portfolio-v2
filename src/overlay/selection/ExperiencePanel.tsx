'use client'

import { useEffect, useState } from 'react'
import { useScene } from '@/store/scene'
import type { SectionId, PillarCompany } from '@/content'
import { SelectionShell } from './SelectionShell'
import { Card, Label, Switcher, Tags, useStagger, MONO, INK, INK_DIM, INK_FAINT, ACCENT } from './kit'

/**
 * Both experience monuments, from one component.
 *
 * Experience I and II differ only in which companies they hold, so they are the
 * same panel given different content rather than two panels kept in sync by
 * hand. Each instance owns its OWN company selection, which is what stops a
 * choice made on one pillar showing up on the other.
 */
export function ExperiencePanel({
  section,
  companies,
}: {
  section: SectionId
  companies: PillarCompany[]
}) {
  const open = useScene((s) => s.openSection) === section

  const [companyId, setCompanyId] = useState(companies[0].id)
  const [roleId, setRoleId] = useState(companies[0].roles[0].id)

  /*
   * Closing resets this pillar to its default company and most recent role.
   *
   * Deferred past the exit transition so the reset is never visible as a flicker
   * of different text on the way out.
   */
  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => {
      setCompanyId(companies[0].id)
      setRoleId(companies[0].roles[0].id)
    }, 240)
    return () => window.clearTimeout(id)
  }, [open, companies])

  const company = companies.find((c) => c.id === companyId) ?? companies[0]
  const role = company.roles.find((r) => r.id === roleId) ?? company.roles[0]

  const meta = useStagger(open, 1)

  return (
    <SelectionShell section={section}>
      <Switcher
        open={open}
        value={company.id}
        onChange={(id) => {
          const next = companies.find((c) => c.id === id) ?? companies[0]
          setCompanyId(next.id)
          // Always land on the most recent role of whatever company you pick.
          setRoleId(next.roles[0].id)
        }}
        options={companies.map((c) => ({ id: c.id, label: c.name }))}
      />

      <div style={meta}>
        <h3 className="text-[15px]" style={{ ...MONO, letterSpacing: '0.16em', color: INK }}>
          {company.name}
        </h3>
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-[9px]" style={{ ...MONO, letterSpacing: '0.2em', color: INK_DIM }}>
            {company.kind}
          </span>
          <span className="text-[9px]" style={{ ...MONO, letterSpacing: '0.2em', color: INK_FAINT }}>
            {company.where}
          </span>
        </p>
      </div>

      {/*
        More than one role at a company: the progression is drawn as a hairline
        with the current position marked in the accent. The most recent is first
        and brighter, which is the whole hierarchy — no "current" badge.
      */}
      {company.roles.length > 1 && (
        <ol className="flex flex-col" style={meta}>
          {company.roles.map((r, i) => {
            const active = r.id === role.id
            return (
              <li key={r.id} className="relative pl-5">
                {i < company.roles.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-[2px] top-[16px] w-px"
                    style={{
                      background:
                        'linear-gradient(180deg, rgba(233,230,222,0.26) 0%, rgba(233,230,222,0.04) 100%)',
                    }}
                  />
                )}
                <span
                  aria-hidden
                  className="absolute left-0 top-[12px] h-[5px] w-[5px] rounded-full"
                  style={{
                    background: i === 0 ? ACCENT : 'rgba(233,230,222,0.26)',
                    boxShadow: i === 0 ? '0 0 10px rgba(196,52,34,0.5)' : 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setRoleId(r.id)}
                  className="w-full py-2 text-left"
                >
                  <span
                    className="block"
                    style={{
                      ...MONO,
                      letterSpacing: '0.16em',
                      fontSize: i === 0 ? '11.5px' : '10.5px',
                      color: active ? INK : INK_FAINT,
                      transition: 'color 200ms ease',
                    }}
                  >
                    {r.title}
                  </span>
                  <span
                    className="mt-0.5 block text-[9px]"
                    style={{ ...MONO, letterSpacing: '0.14em', color: INK_FAINT }}
                  >
                    {r.period}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      )}

      {company.roles.length === 1 && (
        <div style={meta}>
          <Label>{role.period}</Label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {role.cards.map((card, i) => (
          <Card key={`${role.id}-${card.label}-${i}`} card={card} index={i} open={open} />
        ))}
      </div>

      <Tags items={role.stack} open={open} />
    </SelectionShell>
  )
}
