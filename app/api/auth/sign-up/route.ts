import { NextResponse } from 'next/server'
import { Filter } from 'bad-words'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { signUpSchema } from '@/lib/validations'
import { generateSlug } from '@/utils/slug'
import { generateVerificationToken } from '@/utils/token'
import { sendEmailVerification } from '@/lib/resend'
import { getOrCreateSchool } from '@/lib/schools'

const profanityFilter = new Filter()

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = signUpSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { email, password, display_name, school_directory_id } = parsed.data

  if (profanityFilter.isProfane(display_name)) {
    return NextResponse.json(
      { error: 'Display name contains inappropriate language' },
      { status: 400 }
    )
  }

  const supabase = createClient()
  const { data: authData, error: authError } = await supabase.auth.signUp({ email, password })

  if (authError) {
    return NextResponse.json({ error: 'Could not create account' }, { status: 500 })
  }

  // Supabase's anti-enumeration behavior: signing up with an existing email
  // returns success with no error, but an empty `identities` array.
  if (!authData.user || authData.user.identities?.length === 0) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 }
    )
  }

  const serviceClient = createServiceClient()

  let schoolId: string
  try {
    // Sign-up allows any school in the directory, not just launched ones —
    // creates an inactive `schools` row on first use if needed.
    schoolId = await getOrCreateSchool(serviceClient, school_directory_id)
  } catch {
    return NextResponse.json({ error: 'Unrecognized school' }, { status: 400 })
  }

  const slug = generateSlug(display_name)
  const { error: insertError } = await serviceClient.from('users').insert({
    id: authData.user.id,
    display_name,
    slug,
    school_id: schoolId,
    contact_email: email,
  })

  if (insertError) {
    return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
  }

  const token = generateVerificationToken()
  const { error: tokenError } = await serviceClient
    .from('email_verifications')
    .insert({ user_id: authData.user.id, token, email })

  if (!tokenError) {
    try {
      await sendEmailVerification(email, token)
    } catch {
      // Signup already succeeded; the user can resend from /check-email.
    }
  }

  return NextResponse.json({ success: true })
}
