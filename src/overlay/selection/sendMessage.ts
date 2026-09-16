/**
 * THE ONLY PLACE A MESSAGE LEAVES THE BROWSER.
 *
 * Two transports, tried in order of how likely they are to still be working in
 * six months.
 *
 * WEB3FORMS is preferred and needs one access key and nothing else: no account,
 * no OAuth, no domain to verify, no token that Google can revoke. The key is
 * public by design — it identifies the destination inbox, it does not authorise
 * anything else — which is why it can live in the client.
 *
 * EMAILJS is the fallback, kept because it is what the old portfolio used. It
 * relays through a connected Gmail account, and that connection is the part
 * that keeps failing: Google expires the grant, and every repair needs a human
 * to click through a consent screen. A contact form should not depend on that.
 *
 * Whichever runs, the contract above it never changes.
 */

import emailjs from '@emailjs/browser'

/** Web3Forms: one key, no account. See .env.local. */
const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? ''

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID ?? ''
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID ?? ''
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY ?? ''

/** Where contact messages are delivered. */
const DESTINATION = 'sarthaksethi2803@gmail.com'

export interface ContactMessage {
  name: string
  email: string
  subject: string
  message: string
}

/** Thrown for anything the sender could act on; the form shows `message`. */
export class SendError extends Error {}

const hasWeb3Forms = Boolean(WEB3FORMS_KEY)
const hasEmailJs = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

/**
 * Whether any transport is configured.
 *
 * Computed rather than asserted, so a deploy that forgets the environment tells
 * people to use the email link instead of failing at them after they have
 * typed out a message.
 */
export const SEND_ENABLED = hasWeb3Forms || hasEmailJs

async function viaWeb3Forms(payload: ContactMessage): Promise<void> {
  const res = await fetch('https://api.web3forms.com/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      access_key: WEB3FORMS_KEY,
      // Named so the notification email reads like a message rather than a form
      // dump, and so replying to it reaches the sender.
      subject: `Portfolio — ${payload.subject}`,
      from_name: payload.name,
      name: payload.name,
      email: payload.email,
      replyto: payload.email,
      message: payload.message,
    }),
  })

  const body = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null
  if (!res.ok || !body?.success) {
    throw new SendError(
      body?.message
        ? `Could not send (${body.message}). Please use the email link above.`
        : 'Could not send. Please use the email link above.',
    )
  }
}

async function viaEmailJs(payload: ContactMessage): Promise<void> {
  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        to_email: DESTINATION,
        // The VISITOR's details. from_email and reply_to are deliberately the
        // sender's address: the point of asking is knowing who wrote, and being
        // able to answer them in one click.
        from_name: payload.name,
        from_email: payload.email,
        subject: payload.subject,
        message: `${payload.subject}\n\n${payload.message}`,
        reply_to: payload.email,
      },
      { publicKey: PUBLIC_KEY },
    )
  } catch (err) {
    // EmailJS rejects with { status, text }. Surface the text: "invalid
    // template id" is worth seeing, and a bare "failed" is not.
    const detail =
      typeof err === 'object' && err !== null && 'text' in err
        ? String((err as { text: unknown }).text)
        : ''
    throw new SendError(
      detail
        ? `Could not send (${detail}). Please use the email link above.`
        : 'Could not send. Please use the email link above.',
    )
  }
}

export async function sendMessage(payload: ContactMessage): Promise<void> {
  if (hasWeb3Forms) return viaWeb3Forms(payload)
  if (hasEmailJs) return viaEmailJs(payload)
  throw new SendError(
    'Message transport is not configured here — please use the email link above.',
  )
}
