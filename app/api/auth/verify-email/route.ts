import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { matchesSchoolDomain, extractEmailDomain } from '@/lib/school-email'

type ProfileWithSchoolDomain = {
  email_verified_at: string | null
  is_seller_verified: boolean
  schools: {
    email_domains: string[] | null
    schools_directory: { domain: string | null } | null
  } | null
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
    .select(
      'email_verified_at, is_seller_verified, schools(email_domains, schools_directory(domain))'
    )
    .eq('id', verification.user_id)
    .single<ProfileWithSchoolDomain>()

  const schoolDomain = profile?.schools?.schools_directory?.domain
  // Exact match, a strict subdomain (University of Cincinnati students get mail
  // at mail.uc.edu while the directory domain is uc.edu), or one of the school's
  // curated extra domains. See lib/school-email.ts for why a plain endsWith
  // would be unsafe here — buc.edu and uc.edu are both real institutions.
  const isSchoolEmail = matchesSchoolDomain(
    verification.email,
    schoolDomain,
    profile?.schools?.email_domains
  )

  // Log near-misses so schools with an unrelated mail domain are DISCOVERABLE
  // rather than silently blocking their students. The directory only knows
  // each school's website domain, so these cases can't be predicted — but a
  // repeated domain here is the signal to add it to schools.email_domains.
  if (!isSchoolEmail && !profile?.is_seller_verified) {
    console.warn('[verify-email] email domain did not match school', {
      emailDomain: extractEmailDomain(verification.email),
      schoolDomain,
      extraDomains: profile?.schools?.email_domains ?? [],
    })
  }

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

  // Tell the user what actually happened. Previously every outcome redirected
  // to "/" identically, so someone who verified an address that did NOT match
  // their school's domain was still shown "Add a school email to post" — with
  // no hint that the email they just added was the problem.
  const alreadySeller = Boolean(profile?.is_seller_verified)
  const outcome = isSchoolEmail || alreadySeller ? 'seller' : 'email-only'
  return NextResponse.redirect(new URL(`/?verified=${outcome}`, request.url))
}
