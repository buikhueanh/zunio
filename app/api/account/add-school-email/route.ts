import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { addSchoolEmailSchema } from '@/lib/validations'
import { generateVerificationToken } from '@/utils/token'
import { sendEmailVerification } from '@/lib/resend'

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = addSchoolEmailSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }

  const { email } = parsed.data
  const token = generateVerificationToken()
  const serviceClient = createServiceClient()

  const { error: tokenError } = await serviceClient
    .from('email_verifications')
    .upsert({ user_id: user.id, token, email }, { onConflict: 'user_id' })

  if (tokenError) {
    return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 })
  }

  try {
    await sendEmailVerification(email, token)
  } catch {
    return NextResponse.json({ error: 'Could not send verification email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
