import { NextResponse } from 'next/server'
import { Resend } from 'resend'

/**
 * The contact form's server side.
 *
 * The whole reason this file exists: RESEND_API_KEY is read here and nowhere
 * else. It has no NEXT_PUBLIC_ prefix, so Next will not inline it into the
 * browser bundle — the key never leaves the server, and there is nothing in the
 * shipped JavaScript for anyone to read out of it. The previous transports both
 * put a credential in the client because that is the only place they could put
 * one; this one does not have to.
 *
 * Being a public endpoint, it cannot trust anything it is handed. Everything
 * below assumes the caller is hostile: the payload is validated and bounded
 * here rather than in the form, the sender's address is never used as the From
 * (which would let anyone send mail appearing to come from anyone), and there
 * is a rate limit so the inbox cannot be buried by a loop.
 */

export const runtime = 'nodejs'

/** Where messages are delivered. */
const TO = 'sarthaksethi2803@gmail.com'

/**
 * Resend will only send FROM a domain you have verified. Until sethisarthak.com
 * is verified in the Resend dashboard, their shared sender is the one address
 * that works — and it only delivers to the account's own email, which is why TO
 * above must be the address the Resend account was created with.
 */
const FROM = process.env.RESEND_FROM ?? 'Portfolio <onboarding@resend.dev>'

const LIMITS = { name: 120, email: 200, subject: 200, message: 5000 }

/**
 * A deliberately small rate limit, held in memory.
 *
 * Per-instance rather than shared, so it is a speed bump and not a guarantee —
 * but it costs nothing, needs no Redis, and stops the obvious case of someone
 * holding down a script. A serverless instance being recycled resets it, which
 * is an acceptable trade for a contact form.
 */
const WINDOW_MS = 10 * 60_000
const MAX_PER_WINDOW = 12
const hits = new Map<string, number[]>()

/**
 * Never in development.
 *
 * Every request from this machine shares one address, so a few test sends used
 * up the whole allowance and then refused the real message typed right after
 * them. A limit that blocks the person building the site is not protecting
 * anything.
 */
const RATE_LIMIT_ENABLED = process.env.NODE_ENV === 'production'

function rateLimited(ip: string): boolean {
  if (!RATE_LIMIT_ENABLED) return false
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > MAX_PER_WINDOW
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  )
}

export async function POST(request: Request) {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return NextResponse.json(
      { error: 'Messaging is not configured on this deployment.' },
      { status: 503 },
    )
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many messages just now. Please try again shortly.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Malformed request.' }, { status: 400 })
  }

  const data = body as Record<string, unknown>

  // Honeypot: a field no human can see and no human fills in. Answer 200 so a
  // bot learns nothing from the difference.
  if (clean(data.company, 50)) return NextResponse.json({ ok: true })

  const name = clean(data.name, LIMITS.name)
  const email = clean(data.email, LIMITS.email)
  const subject = clean(data.subject, LIMITS.subject)
  const message = clean(data.message, LIMITS.message)

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: 'Every field is required.' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'That email address looks wrong.' }, { status: 400 })
  }

  try {
    const resend = new Resend(key)
    const { error } = await resend.emails.send({
      // FROM is always our own verified sender. Putting the visitor's address
      // here would be sending mail as them, which mail providers correctly
      // treat as forgery — replyTo is how you actually answer them.
      from: FROM,
      to: [TO],
      replyTo: email,
      subject: `Portfolio — ${subject}`,
      text: `${message}\n\n—\n${name}\n${email}`,
      html:
        `<div style="font-family:ui-monospace,monospace;font-size:14px;line-height:1.6">` +
        `<p style="white-space:pre-wrap;margin:0 0 20px">${escapeHtml(message)}</p>` +
        `<hr style="border:none;border-top:1px solid #ddd;margin:20px 0">` +
        `<p style="margin:0;color:#666">${escapeHtml(name)}<br>` +
        `<a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a></p>` +
        `</div>`,
    })

    if (error) {
      // Logged in full server-side; the caller gets the message only.
      console.error('[contact] resend error:', error)
      return NextResponse.json({ error: error.message ?? 'Send failed.' }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact] unexpected:', err)
    return NextResponse.json({ error: 'Send failed.' }, { status: 502 })
  }
}
