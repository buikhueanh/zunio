import { NextResponse } from 'next/server'
import { Filter } from 'bad-words'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { signUpSchema } from '@/lib/validations'
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

  const { email, password, first_name, last_name, username, school_directory_id } = parsed.data

  // Filter every user-authored identity field, not just one — all three are
  // publicly visible on listings and profiles.
  const profaneField = [first_name, last_name, username].find(
    (value) => value && profanityFilter.isProfane(value)
  )
  if (profaneField) {
    return NextResponse.json(
      { error: 'Name or username contains inappropriate language' },
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

  // display_name is NOT set here — it is a generated column derived from
  // first_name/last_name (migration 014), so it cannot drift out of sync.
  const { error: insertError } = await serviceClient.from('users').insert({
    id: authData.user.id,
    first_name,
    last_name,
    username,
    school_id: schoolId,
    contact_email: email,
  })

  if (insertError) {
    // The auth user already exists at this point. Leaving it behind would
    // strand the person in a half-created state: able to sign in, but with no
    // profile row — and unable to sign up again, because the email is now
    // taken (409). Roll it back so a retry actually works.
    await serviceClient.auth.admin.deleteUser(authData.user.id).catch((err) => {
      console.error('[sign-up] orphaned auth user, manual cleanup needed', {
        userId: authData.user?.id,
        err,
      })
    })

    // 23505 = unique violation. The only unique constraint reachable here is
    // users_username_lower_key: someone claimed the username between the
    // client's availability check and this insert. The DB is the real
    // guarantee — an application-level pre-check cannot win that race.
    if (insertError.code === '23505') {
      return NextResponse.json(
        { error: 'That username was just taken. Please choose another.' },
        { status: 409 }
      )
    }

    console.error('[sign-up] profile insert failed', insertError)
    return NextResponse.json({ error: 'Could not create profile' }, { status: 500 })
  }

  const token = generateVerificationToken()
  const { error: tokenError } = await serviceClient
    .from('email_verifications')
    .insert({ user_id: authData.user.id, token, email })

  if (!tokenError) {
    try {
      await sendEmailVerification(email, token)
      await serviceClient
        .from('email_verifications')
        .update({ sent_at: new Date().toISOString() })
        .eq('user_id', authData.user.id)
    } catch (err) {
      // The account exists and they're signed in — failing here would strand
      // them (a retry would hit "email already exists"). They can resend from
      // /check-email; sent_at stays null so the failure stays findable.
      console.error('[sign-up] verification email failed', { email, err })
    }
  }

  return NextResponse.json({ success: true })
}
