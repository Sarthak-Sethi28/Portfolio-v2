'use client'

import { useEffect, useState } from 'react'
import { useScene } from '@/store/scene'
import { experiencePillar, type PillarRole } from '@/content/pillars'
import { SelectionShell, GLASS, MONO, ACCENT } from './SelectionShell'

/**
 * PILLAR 01 — EXPERIENCE I.
 *
 * Two levels, not a résumé dump. The pillar opens on the companies; choosing
 * one opens its roles. Volaris leads because it is the most recent and the
 * strongest, and its two roles are shown together so the progression within one
 * company is visible before you have clicked anything.
 */
export function ExperiencePanel() {
  const open = useScene((s) => s.openSection) === 'experience'

  /** Which company is expanded. Volaris — the lead — starts open. */
  const [companyId, setCompanyId] = useState<string>(
    () => experiencePillar.find((c) => c.lead)?.id ?? experiencePillar[0].id,
  )
  /** Which role's detail is showing, or null for the company overview. */
  const [roleId, setRoleId] = useState<string | null>(null)

  // Reopening the pillar should not resume someone else's half-finished
  // navigation from ten minutes ago.
  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => {
      setCompanyId(experiencePillar.find((c) => c.lead)?.id ?? experiencePillar[0].id)
      setRoleId(null)
    }, 220)
    return () => window.clearTimeout(id)
  }, [open])

  const company = experiencePillar.find((c) => c.id === companyId) ?? experiencePillar[0]
  const role = roleId ? company.roles.find((r) => r.id === roleId) ?? null : null

  return (
    <SelectionShell section="experience">
      <header className="mb-4 flex items-baseline justify-between px-1">
        <h2 className="text-[11px] sm:text-xs" style={{ ...MONO, color: 'rgba(240,237,230,0.92)' }}>
          Experience
        </h2>
        <span
          className="text-[10px]"
          style={{ ...MONO, letterSpacing: '0.3em', color: 'rgba(240,237,230,0.38)' }}
        >
          {role ? 'Role' : 'I'}
        </span>
      </header>

      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {experiencePillar.map((c) => {
          const active = c.id === company.id
          return (
            <section
              key={c.id}
              style={{
                ...GLASS,
                borderColor: active ? 'rgba(233,230,222,0.17)' : 'rgba(233,230,222,0.07)',
                transition: 'border-color 240ms ease, opacity 240ms ease',
                opacity: active ? 1 : 0.62,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setCompanyId(c.id)
                  setRoleId(null)
                }}
                className="flex w-full items-baseline justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="flex items-baseline gap-3">
                  {/* The lead company is marked by weight and a rule, not by a badge. */}
                  <span
                    className="text-[13px] sm:text-sm"
                    style={{
                      ...MONO,
                      letterSpacing: '0.2em',
                      color: 'rgba(244,241,234,0.96)',
                      fontWeight: c.lead ? 500 : 400,
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    className="hidden text-[10px] sm:inline"
                    style={{ ...MONO, letterSpacing: '0.18em', color: 'rgba(240,237,230,0.34)' }}
                  >
                    {c.location}
                  </span>
                </span>
                <span
                  className="shrink-0 text-[10px]"
                  style={{ ...MONO, letterSpacing: '0.14em', color: 'rgba(240,237,230,0.46)' }}
                >
                  {c.period}
                </span>
              </button>

              {active && (
                <div className="px-5 pb-5">
                  {role ? (
                    <RoleDetail role={role} onBack={() => setRoleId(null)} />
                  ) : (
                    <ol className="flex flex-col">
                      {c.roles.map((r, i) => (
                        <RoleRow
                          key={r.id}
                          role={r}
                          /* Index 0 is the most recent position and carries the
                             most weight — the brief's PM-over-engineer ordering
                             falls straight out of the data being reverse
                             chronological. */
                          senior={i === 0}
                          continues={i < c.roles.length - 1}
                          onOpen={() => setRoleId(r.id)}
                        />
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </SelectionShell>
  )
}

/**
 * One role in the company overview.
 *
 * Progression within a company is drawn as a single hairline running down the
 * left of the stack, with each role's marker sitting on it. That reads as "this
 * came after that" without a literal arrow, and it costs one border and one dot
 * rather than a graphic.
 */
function RoleRow({
  role,
  senior,
  continues,
  onOpen,
}: {
  role: PillarRole
  senior: boolean
  continues: boolean
  onOpen: () => void
}) {
  return (
    <li className="relative pl-6">
      {/* The thread of the progression. */}
      {continues && (
        <span
          aria-hidden
          className="absolute left-[3px] top-[18px] bottom-0 w-px"
          style={{
            background:
              'linear-gradient(180deg, rgba(233,230,222,0.28) 0%, rgba(233,230,222,0.05) 100%)',
          }}
        />
      )}
      <span
        aria-hidden
        className="absolute left-0 top-[14px] h-[7px] w-[7px] rounded-full"
        style={{
          background: senior ? ACCENT : 'rgba(233,230,222,0.30)',
          boxShadow: senior ? '0 0 12px rgba(196,42,28,0.55)' : 'none',
        }}
      />

      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full flex-col gap-1 py-3 text-left"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span
            style={{
              ...MONO,
              letterSpacing: '0.16em',
              // The most recent role is brighter and larger. That is the whole
              // hierarchy — no badge, no "current" pill.
              fontSize: senior ? '12.5px' : '11px',
              color: senior ? 'rgba(244,241,234,0.95)' : 'rgba(240,237,230,0.66)',
            }}
          >
            {role.title}
          </span>
          <span
            className="shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
            style={{ ...MONO, fontSize: '10px', color: 'rgba(240,237,230,0.5)' }}
          >
            →
          </span>
        </span>
        <span
          style={{
            ...MONO,
            letterSpacing: '0.13em',
            fontSize: '10px',
            color: senior ? 'rgba(240,237,230,0.52)' : 'rgba(240,237,230,0.36)',
          }}
        >
          {role.period}
        </span>
        <span
          className="mt-1 text-[12px] leading-relaxed"
          style={{
            color: senior ? 'rgba(232,228,220,0.74)' : 'rgba(232,228,220,0.52)',
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          {role.summary}
        </span>
      </button>
    </li>
  )
}

/** The role's cards. Compact blocks, never a wall of bullets. */
function RoleDetail({ role, onBack }: { role: PillarRole; onBack: () => void }) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-2 py-1"
        style={{ ...MONO, fontSize: '10px', color: 'rgba(240,237,230,0.5)' }}
      >
        <span aria-hidden>←</span> Back
      </button>

      <div className="mb-4">
        <h3
          className="text-[13px]"
          style={{ ...MONO, letterSpacing: '0.18em', color: 'rgba(244,241,234,0.96)' }}
        >
          {role.title}
        </h3>
        <p
          className="mt-1 text-[10px]"
          style={{ ...MONO, letterSpacing: '0.13em', color: 'rgba(240,237,230,0.5)' }}
        >
          {role.period}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {role.cards.map((card, i) => (
          <article
            key={`${card.label}-${i}`}
            className="px-4 py-3"
            style={{
              background: 'rgba(233,230,222,0.035)',
              border: '1px solid rgba(233,230,222,0.08)',
            }}
          >
            <span
              className="text-[9px]"
              style={{ ...MONO, letterSpacing: '0.3em', color: 'rgba(196,42,28,0.78)' }}
            >
              {card.label}
            </span>
            <p
              className="mt-2 text-[12px] leading-relaxed"
              style={{ color: 'rgba(232,228,220,0.76)' }}
            >
              {card.body}
            </p>
          </article>
        ))}
      </div>

      {role.stack.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {role.stack.map((s) => (
            <li
              key={s}
              className="text-[9px]"
              style={{ ...MONO, letterSpacing: '0.2em', color: 'rgba(240,237,230,0.42)' }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
