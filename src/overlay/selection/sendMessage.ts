/**
 * THE ONLY PLACE A MESSAGE LEAVES THE BROWSER.
 *
 * There is no key in this file, and there is no key anywhere else in the
 * client. That is the entire point of it.
 *
 * The two transports before this one — EmailJS, then Web3Forms — both required
 * a credential in the browser, because neither has a server to keep one on.
 * Anything a browser holds is readable by anyone who opens the bundle, so the
 * only real fix was to stop asking the browser to hold anything. This posts to
 * our own API route; the Resend key lives there, server-side, and never ships.
 *
 * The route validates everything again on its side. Nothing here is a security
 * boundary — the checks below exist to give the visitor an immediate answer,
 * not to protect the endpoint, which assumes it is being called by a stranger.
 */

export interface ContactMessage {
  name: string
  email: string
  subject: string
  message: string
}

/** Thrown for anything the sender could act on; the form shows `message`. */
export class SendError extends Error {}

/**
 * Always true now.
 *
 * Whether a transport is actually configured is a server-side fact, and asking
 * the client to know it would mean publishing something about the server. If it
 * is not configured the route answers 503 and the form says so — which is the
 * same outcome, arrived at without leaking anything.
 */
export const SEND_ENABLED = true

export async function sendMessage(payload: ContactMessage): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        subject: payload.subject,
        message: payload.message,
        // Honeypot, always empty from a real visitor. See the route.
        company: '',
      }),
    })
  } catch {
    throw new SendError('No connection. Please use the email link above.')
  }

  if (res.ok) return

  const body = (await res.json().catch(() => null)) as { error?: string } | null
  // The server's message is used as written. Appending "please use the email
  // link above" to everything produced sentences like "Try again in a minute.
  // Please use the email link above." — two different instructions in one
  // breath. The Open-in-mail link sits right beside this and says it better.
  throw new SendError(body?.error ?? 'Could not send. Please use the email link above.')
}
