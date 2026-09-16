/**
 * THE ONLY PLACE A MESSAGE LEAVES THE BROWSER.
 *
 * EmailJS — the same service the live portfolio used before its contact form
 * was deleted in the July revamp. That revamp's own spec lists "no EmailJS code
 * or deps remain" on its checklist, so the working configuration was recovered
 * from the commit before the deletion, along with the three template variables
 * it expects.
 *
 * The three identifiers are PUBLIC by design: EmailJS ships its public key in
 * the browser bundle, and the service and template ids are visible in any
 * network tab. They are nonetheless read from the environment rather than
 * written here, so the account can be rotated without touching code and so
 * nothing account-shaped sits in the repository. See .env.local.
 *
 * The recovered template renders `from_name`, `from_email` and `message`, and
 * has no subject field of its own — so the subject is carried into the body as
 * well as passed through. An unused parameter is ignored; a dropped one is not.
 */

import emailjs from '@emailjs/browser'

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

/**
 * Whether a transport is configured.
 *
 * Checked against the real values rather than assumed, so a deploy that forgets
 * the environment tells the visitor to use the email link instead of failing at
 * them after they have typed out a message.
 */
export const SEND_ENABLED = Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY)

export async function sendMessage(payload: ContactMessage): Promise<void> {
  if (!SEND_ENABLED) {
    throw new SendError(
      'Message transport is not configured here — please use the email link above.',
    )
  }

  try {
    await emailjs.send(
      SERVICE_ID,
      TEMPLATE_ID,
      {
        // Where the message lands. The template's own To field may already be
        // set, in which case this is ignored — but if it is bound to a variable
        // this is what routes it, and an unused parameter costs nothing.
        to_email: DESTINATION,
        // The VISITOR's details. from_email and reply_to are deliberately the
        // sender's address, not the destination: the whole point of the field is
        // knowing who wrote and being able to answer them with one click.
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
