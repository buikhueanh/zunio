import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { waitlistSchema } from '@/lib/validations'
import { sendWaitlistConfirmation } from '@/lib/resend'

const DUPLICATE_KEY_ERROR = '23505'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = waitlistSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { email, school_id, school_name_raw } = parsed.data
  const supabase = createServiceClient()

  const { error } = await supabase.from('waitlist').insert({
    email,
    school_id: school_id ?? null,
    school_name_raw: school_id ? null : school_name_raw ?? null,
  })

  if (error) {
    if (error.code === DUPLICATE_KEY_ERROR) {
      // Already on the list — return success silently, no re-send.
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }

  try {
    await sendWaitlistConfirmation(email)
    await supabase
      .from('waitlist')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('email', email)
  } catch (err) {
    // They ARE on the list — the row exists, which is what they actually wanted.
    // Don't fail the request over the confirmation email. confirmation_sent_at
    // stays null so failed sends stay findable and retryable.
    console.error('[waitlist] confirmation email failed', { email, err })
  }

  return NextResponse.json({ success: true })
}
