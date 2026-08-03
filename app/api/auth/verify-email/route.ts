import { NextResponse, type NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(new URL('/check-email', request.url))
  }

  const supabase = createServiceClient()
  const { data: verification } = await supabase
    .from('email_verifications')
    .select('user_id')
    .eq('token', token)
    .maybeSingle()

  if (!verification) {
    return NextResponse.redirect(new URL('/check-email', request.url))
  }

  await supabase
    .from('users')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('id', verification.user_id)

  // Single-use — remove the token now that it's been redeemed.
  await supabase.from('email_verifications').delete().eq('user_id', verification.user_id)

  return NextResponse.redirect(new URL('/', request.url))
}
