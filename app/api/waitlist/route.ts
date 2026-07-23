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
  } catch {
    // Signup already succeeded; don't fail the request over a flaky email send.
  }

  return NextResponse.json({ success: true })
}
