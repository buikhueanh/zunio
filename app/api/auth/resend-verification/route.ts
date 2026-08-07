import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { generateVerificationToken } from '@/utils/token'
import { sendEmailVerification } from '@/lib/resend'

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const token = generateVerificationToken()
  const serviceClient = createServiceClient()
  const { error: tokenError } = await serviceClient
    .from('email_verifications')
    // sent_at explicitly reset — otherwise a stale timestamp from an earlier
    // successful send would survive the upsert and make a new failure look sent.
    .upsert(
      { user_id: user.id, token, email: user.email, sent_at: null },
      { onConflict: 'user_id' }
    )

  if (tokenError) {
    return NextResponse.json({ error: 'Could not resend verification email' }, { status: 500 })
  }

  try {
    await sendEmailVerification(user.email, token)
  } catch (err) {
    // Sending the email IS this request — a failure here is a real failure, so
    // say so rather than telling them to check an inbox nothing was sent to.
    console.error('[resend-verification] email failed', { email: user.email, err })
    return NextResponse.json({ error: 'Could not resend verification email' }, { status: 500 })
  }

  await serviceClient
    .from('email_verifications')
    .update({ sent_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ success: true })
}
