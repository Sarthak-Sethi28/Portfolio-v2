/**
 * THE ONLY PLACE A MESSAGE LEAVES THE BROWSER.
 *
 * Nothing is wired up yet, and this deliberately does not pretend otherwise: it
 * rejects, the form shows its error state, and no one is told their message was
 * delivered when it was thrown away. A contact form that fakes success is worse
 * than no contact form, because the sender stops trying.
 *
 * TO CONNECT IT, pick one and replace the body of `sendMessage`:
 *
 *   Formspree   POST to https://formspree.io/f/<id> with this JSON. No server,
 *               no secret in the bundle. Quickest by some distance.
 *
 *   Resend      Needs an API route — the key must never reach the client. Add
 *               app/api/contact/route.ts, keep RESEND_API_KEY server-side, and
 *               POST to '/api/contact' from here.
 *
 *   EmailJS     Client-side with a public key. Fine, but the key is visible and
 *               the free tier is rate-limited.
 *
 * Whichever it is, the signature below does not change, so nothing in the form
 * needs touching.
 */

export interface ContactMessage {
  name: string
  email: string
  subject: string
  message: string
}

/** Thrown for anything the sender could act on; the form shows `message`. */
export class SendError extends Error {}

export async function sendMessage(payload: ContactMessage): Promise<void> {
  // Referenced so the parameter is part of the signature a transport must
  // honour, and so this file does not quietly drift out of shape while unused.
  void payload
  throw new SendError(
    'Message transport is not connected yet — please use the email link above.',
  )
}

/** Whether a transport exists, so the form can say so honestly up front. */
export const SEND_ENABLED = false
