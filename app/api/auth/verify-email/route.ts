import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

type ProfileWithSchoolDomain = {
  email_verified_at: string | null
  schools: { schools_directory: { domain: string | null } | null } | null
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/check-email', request.url))
  }

  const supabase = createServiceClient()
  const { data: verification } = await supabase
    .from('email_verifications')
    .select('user_id, email')
    .eq('token', token)
    .maybeSingle()

  if (!verification) {
    return NextResponse.redirect(new URL('/check-email', request.url))
  }

  const { data: profile } = await supabase
    .from('users')
    .select('email_verified_at, schools(schools_directory(domain))')
    .eq('id', verification.user_id)
    .single<ProfileWithSchoolDomain>()

  const schoolDomain = profile?.schools?.schools_directory?.domain
  const emailDomain = verification.email.split('@')[1]?.toLowerCase() ?? ''
  const isSchoolEmail = Boolean(schoolDomain) && emailDomain === schoolDomain?.toLowerCase()

  const updates: { email_verified_at?: string; is_seller_verified?: boolean } = {}
  // Only set on first verification — adding a school email later shouldn't
  // reset when the account was originally confirmed.
  if (!profile?.email_verified_at) updates.email_verified_at = new Date().toISOString()
  if (isSchoolEmail) updates.is_seller_verified = true

  if (Object.keys(updates).length > 0) {
    await supabase.from('users').update(updates).eq('id', verification.user_id)
  }

  // Single-use — remove the token now that it's been redeemed.
  await supabase.from('email_verifications').delete().eq('user_id', verification.user_id)

  return NextResponse.redirect(new URL('/', request.url))
}
