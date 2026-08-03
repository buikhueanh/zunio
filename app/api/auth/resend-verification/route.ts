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
    .upsert({ user_id: user.id, token, email: user.email }, { onConflict: 'user_id' })

  if (tokenError) {
    return NextResponse.json({ error: 'Could not resend verification email' }, { status: 500 })
  }

  try {
    await sendEmailVerification(user.email, token)
  } catch {
    return NextResponse.json({ error: 'Could not resend verification email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
