import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizeUsername, isValidUsername } from '@/utils/username'

/**
 * Availability hint for the sign-up form.
 *
 * This is a CONVENIENCE, not the guarantee. Two people can both check the same
 * username, both be told it's free, and both submit — only the unique index in
 * migration 014 settles it, and the sign-up route handles the resulting 23505.
 * Never treat a positive answer here as a reservation.
 *
 * Public, unauthenticated (it has to run before an account exists), so it
 * deliberately returns only a boolean — no user data, no "who has it".
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const raw = typeof body?.username === 'string' ? body.username : ''
  const username = normalizeUsername(raw)

  if (!isValidUsername(username)) {
    return NextResponse.json({ available: false, reason: 'invalid' })
  }

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from('users')
    .select('id')
    .ilike('username', username)
    .maybeSingle()

  if (error) {
    console.error('[username-available] lookup failed', error)
    // Fail closed: claiming "available" on an error would send the user
    // confidently into a submit that then fails.
    return NextResponse.json({ available: false, reason: 'error' }, { status: 500 })
  }

  return NextResponse.json({ available: !data })
}
