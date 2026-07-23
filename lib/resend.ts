import { Resend } from 'resend'
import { colors } from '@/lib/design-tokens'

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
