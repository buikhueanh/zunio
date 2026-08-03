import { Resend } from 'resend'
import { colors } from '@/lib/design-tokens'
import { siteConfig } from '@/config/site'

const FROM = process.env.EMAIL_FROM ?? 'hello@zunio.app'

export async function sendWaitlistConfirmation(email: string) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  return resend.emails.send({
    from: FROM,
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
  const resend = new Resend(process.env.RESEND_API_KEY)
  const verifyUrl = `${siteConfig.url}/api/auth/verify-email?token=${token}`

  return resend.emails.send({
    from: FROM,
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
