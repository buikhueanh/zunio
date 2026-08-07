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
