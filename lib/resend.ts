import { Resend } from 'resend'
import { colors } from '@/lib/design-tokens'
import { siteConfig } from '@/config/site'

const FROM = process.env.EMAIL_FROM ?? 'team@zunio.org'

type EmailPayload = {
  to: string
  subject: string
  text: string
  html: string
}

/**
 * Escapes user-authored text before it goes into an email's HTML.
 *
 * MANDATORY for anything a user typed. Every other email in this file
 * interpolates only server-controlled values (URLs, tokens), but message
 * notifications carry text written by one student and delivered to another
 * from our verified sending domain. Unescaped, a message body could inject
 * `<a href="...">` and turn a Zunio-branded email — trusted precisely because
 * it comes from us — into a phishing delivery vehicle.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Resend's SDK reports API failures (unverified domain, bad key, rate limit) as
// a returned `error` value rather than a thrown exception — so a plain
// `try { send() } catch {}` never fires and a failed send is indistinguishable
// from a successful one. Normalize to a throw so callers can rely on try/catch.
// See docs/CHANGELOG.md 2026-08-05.
async function send({ to, subject, text, html }: EmailPayload) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({ from: FROM, to, subject, text, html })

  if (error) {
    throw new Error(`Resend send failed (${error.name}): ${error.message}`)
  }
  return data
}

export async function sendWaitlistConfirmation(email: string) {
  return send({
    to: email,
    subject: "You're on the list",
    text: [
      "You're on the Zunio waitlist.",
      '',
      "We'll email you the moment your school launches — no spam before then.",
      '',
      '— Zunio',
    ].join('\n'),
    html: [
      `<p>You're on the <strong style="color: ${colors.emerald}">Zunio</strong> waitlist.</p>`,
      "<p>We'll email you the moment your school launches — no spam before then.</p>",
      `<p style="color: ${colors.emerald}">— Zunio</p>`,
    ].join('\n'),
  })
}

export async function sendEmailVerification(email: string, token: string) {
  const verifyUrl = `${siteConfig.url}/api/auth/verify-email?token=${token}`

  return send({
    to: email,
    subject: 'Verify your email',
    text: [
      'Verify your email to start posting listings on Zunio.',
      '',
      verifyUrl,
      '',
      "If you didn't create this account, you can ignore this email.",
    ].join('\n'),
    html: [
      '<p>Verify your email to start posting listings on Zunio.</p>',
      `<p><a href="${verifyUrl}" style="color: ${colors.emerald}">Verify email</a></p>`,
      `<p style="color: ${colors.gray[500]}; font-size: 13px;">If you didn't create this account, you can ignore this email.</p>`,
    ].join('\n'),
  })
}

const PREVIEW_LIMIT = 300

/**
 * Tells someone they have unread messages in a conversation.
 *
 * senderName, listingTitle and preview are ALL user-authored and are escaped
 * before reaching the HTML. Reply-to is deliberately not set to the sender's
 * address: unlike the original email-relay design, replies happen in the app,
 * so neither party's email is disclosed to the other.
 */
export async function sendMessageNotification({
  to,
  senderName,
  listingTitle,
  preview,
  conversationId,
}: {
  to: string
  senderName: string
  listingTitle: string
  preview: string
  conversationId: string
}) {
  const threadUrl = `${siteConfig.url}/messages/${conversationId}`
  const trimmed =
    preview.length > PREVIEW_LIMIT ? `${preview.slice(0, PREVIEW_LIMIT)}...` : preview

  return send({
    to,
    subject: `${senderName} messaged you about ${listingTitle}`,
    text: [
      `${senderName} sent you a message about "${listingTitle}":`,
      '',
      trimmed,
      '',
      `Reply here: ${threadUrl}`,
      '',
      '— Zunio',
    ].join('\n'),
    html: [
      `<p>${escapeHtml(senderName)} sent you a message about "${escapeHtml(listingTitle)}":</p>`,
      `<blockquote style="margin: 12px 0; padding: 8px 14px; border-left: 3px solid ${colors.gray[200]}; color: ${colors.gray[600]}; white-space: pre-wrap;">${escapeHtml(trimmed)}</blockquote>`,
      `<p><a href="${threadUrl}" style="color: ${colors.emerald}">Reply on Zunio</a></p>`,
      `<p style="color: ${colors.gray[500]}; font-size: 13px;">You're receiving this because someone messaged you about your listing.</p>`,
    ].join('\n'),
  })
}
