'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { useScene } from '@/store/scene'
import { profile } from '@/content'
import { SelectionShell } from './SelectionShell'
import { Label, useStagger, MONO, INK, INK_DIM, INK_FAINT, ACCENT } from './kit'
import { SEND_ENABLED, SendError, sendMessage } from './sendMessage'

/**
 * 04 — CONTACT. A destination, not four links.
 *
 * Every address here comes from `profile`. Nothing on this panel is invented:
 * where a link does not exist yet, the card says so rather than pointing
 * somewhere plausible.
 */

const github = profile.socials.find((s) => s.label === 'GitHub')?.href ?? null
const linkedin = profile.socials.find((s) => s.label === 'LinkedIn')?.href ?? null

/** Last path segment, for showing a handle instead of a URL. */
function handle(url: string | null): string {
  if (!url) return ''
  return url.replace(/\/+$/, '').split('/').pop() ?? ''
}

const LINKS: { label: string; value: string; href: string | null }[] = [
  { label: 'Email', value: profile.email, href: `mailto:${profile.email}` },
  { label: 'LinkedIn', value: handle(linkedin), href: linkedin },
  { label: 'GitHub', value: handle(github), href: github },
  /*
   * Deliberately not linked.
   *
   * The PDF the live site serves is out of date, and an out-of-date CV behind a
   * confident link is worse than no link — the card says so instead. Restore
   * the href once the current document is in place.
   */
  { label: 'Résumé', value: 'On request', href: null },
]

type Status = 'idle' | 'submitting' | 'sent' | 'error'

export function ContactPanel() {
  const open = useScene((s) => s.openSection) === 'contact'

  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) return
    const id = window.setTimeout(() => {
      setStatus('idle')
      setError(null)
      setTouched({})
    }, 240)
    return () => window.clearTimeout(id)
  }, [open])

  const errors = {
    name: form.name.trim() ? null : 'Required',
    // Deliberately permissive. A stricter pattern rejects real addresses, and
    // the only authority on whether an address works is the mail server.
    email: !form.email.trim()
      ? 'Required'
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
        ? null
        : 'Enter a valid email',
    subject: form.subject.trim() ? null : 'Required',
    message: form.message.trim() ? null : 'Required',
  }
  const valid = Object.values(errors).every((e) => e === null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ name: true, email: true, subject: true, message: true })
    if (!valid || status === 'submitting') return

    setStatus('submitting')
    setError(null)
    try {
      await sendMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      })
      setStatus('sent')
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err) {
      setStatus('error')
      setError(
        err instanceof SendError
          ? err.message
          : 'Could not send. Please use the email link above.',
      )
    }
  }

  /*
   * THE ESCAPE HATCH.
   *
   * If the transport is down, the worst outcome is a visitor who typed a
   * considered message, got an error, and walked away. This hands their own
   * words straight into a mail draft — subject and body already filled — so a
   * broken send costs them one click rather than the whole message.
   */
  const mailtoHref = () => {
    const body = `${form.message}\n\n—\n${form.name}\n${form.email}`
    return `mailto:${profile.email}?subject=${encodeURIComponent(form.subject || 'Hello')}&body=${encodeURIComponent(body)}`
  }

  const linksEnter = useStagger(open, 1)
  const formEnter = useStagger(open, 4)

  return (
    <SelectionShell section="contact">
      <div className="flex flex-col gap-2.5" style={linksEnter}>
        <Label>Direct</Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {LINKS.map((l) => {
            const inert = l.href === null
            const body = (
              <>
                <Label tone={INK_FAINT}>{l.label}</Label>
                <span className="mt-1.5 flex items-baseline justify-between gap-3">
                  <span
                    className="truncate text-[11.5px]"
                    style={{ color: inert ? INK_FAINT : 'rgba(234,230,222,0.82)' }}
                  >
                    {l.value}
                  </span>
                  {!inert && (
                    <span
                      aria-hidden
                      className="shrink-0 text-[11px] transition-transform duration-200 group-hover:translate-x-0.5"
                      style={{ color: INK_DIM }}
                    >
                      ↗
                    </span>
                  )}
                </span>
              </>
            )

            const style: CSSProperties = {
              background: 'rgba(233,230,222,0.028)',
              border: '1px solid rgba(233,230,222,0.07)',
              opacity: inert ? 0.55 : 1,
            }

            return inert ? (
              <div key={l.label} className="px-4 py-3" style={style} aria-disabled>
                {body}
              </div>
            ) : (
              <a
                key={l.label}
                href={l.href ?? undefined}
                target={l.href?.startsWith('mailto:') ? undefined : '_blank'}
                rel="noreferrer noopener"
                className="group px-4 py-3 transition-colors duration-200 hover:bg-[rgba(233,230,222,0.05)]"
                style={style}
              >
                {body}
              </a>
            )
          })}
        </div>
      </div>

      <form className="mt-2 flex flex-col gap-3" style={formEnter} onSubmit={onSubmit} noValidate>
        <Label>Send a message</Label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label="Name"
            value={form.name}
            error={touched.name ? errors.name : null}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            onBlur={() => setTouched((t) => ({ ...t, name: true }))}
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            error={touched.email ? errors.email : null}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          />
        </div>

        <Field
          label="Subject"
          value={form.subject}
          error={touched.subject ? errors.subject : null}
          onChange={(v) => setForm((f) => ({ ...f, subject: v }))}
          onBlur={() => setTouched((t) => ({ ...t, subject: true }))}
        />

        {/*
          Honeypot. Off-screen, unfocusable and hidden from assistive tech, so
          no human ever meets it — a filled value means a bot, and the server
          answers 200 anyway so it learns nothing from the difference.
        */}
        <input
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
        />

        <Field
          label="Message"
          multiline
          value={form.message}
          error={touched.message ? errors.message : null}
          onChange={(v) => setForm((f) => ({ ...f, message: v }))}
          onBlur={() => setTouched((t) => ({ ...t, message: true }))}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="submit"
            disabled={status === 'submitting'}
            className="px-5 py-2.5 text-[9.5px] transition-colors duration-200"
            style={{
              ...MONO,
              letterSpacing: '0.28em',
              color: status === 'submitting' ? INK_FAINT : INK,
              border: '1px solid rgba(233,230,222,0.18)',
              background: 'rgba(233,230,222,0.04)',
              cursor: status === 'submitting' ? 'progress' : 'pointer',
            }}
          >
            {status === 'submitting' ? 'Sending…' : 'Send message'}
          </button>

          <p className="text-[10px]" role="status" aria-live="polite">
            {status === 'sent' && <span style={{ color: INK_DIM }}>Message sent.</span>}
            {status === 'error' && error && (
              <span className="flex flex-wrap items-center gap-2">
                <span style={{ color: ACCENT }}>{error}</span>
                <a
                  href={mailtoHref()}
                  className="underline underline-offset-2"
                  style={{ ...MONO, fontSize: '9px', letterSpacing: '0.18em', color: INK }}
                >
                  Open in mail
                </a>
              </span>
            )}
            {status === 'idle' && !SEND_ENABLED && (
              <span style={{ color: INK_FAINT }}>Email link works today.</span>
            )}
          </p>
        </div>
      </form>
    </SelectionShell>
  )
}

/**
 * One field.
 *
 * A rule under the text rather than a rounded box: a bordered input is the most
 * recognisable piece of generic product design there is, and one of them would
 * pull the whole panel out of this world.
 */
function Field({
  label,
  value,
  onChange,
  onBlur,
  error,
  multiline = false,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  error: string | null
  multiline?: boolean
  type?: string
}) {
  const [focused, setFocused] = useState(false)

  const shared: CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${
      error ? 'rgba(196,52,34,0.6)' : focused ? 'rgba(233,230,222,0.34)' : 'rgba(233,230,222,0.11)'
    }`,
    outline: 'none',
    color: INK,
    fontSize: '12.5px',
    padding: '6px 0',
    transition: 'border-color 220ms ease',
    resize: multiline ? 'vertical' : undefined,
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between gap-2">
        <Label tone={INK_FAINT}>{label}</Label>
        {error && (
          <span className="text-[9px]" style={{ ...MONO, letterSpacing: '0.16em', color: ACCENT }}>
            {error}
          </span>
        )}
      </span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            onBlur()
          }}
          style={shared}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            onBlur()
          }}
          style={shared}
        />
      )}
    </label>
  )
}
