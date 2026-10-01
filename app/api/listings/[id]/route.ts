import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Only the two states a seller controls. 'removed' is a moderation action and
// 'expired' belongs to the expiry cron — neither may be reachable from a
// user-facing endpoint, or a seller could un-expire their own listing forever
// or quietly hide one that was removed for breaking the AUP.
const patchSchema = z.object({
  status: z.enum(['active', 'sold']),
})

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: profile } = await service
    .from('users')
    .select('is_suspended, deleted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.deleted_at) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }
  if (profile.is_suspended) {
    return NextResponse.json({ error: 'This account is suspended' }, { status: 403 })
  }

  const { data: listing } = await service
    .from('listings')
    .select('id, user_id, status, deleted_at')
    .eq('id', params.id)
    .maybeSingle()

  // Ownership is the authorization here, and it has to be checked explicitly:
  // this route writes with the service role, which bypasses RLS entirely.
  // Same 404 for "no such listing" and "not yours", so the endpoint can't be
  // used to discover which listing ids exist.
  if (!listing || listing.deleted_at || listing.user_id !== user.id) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }

  // A listing taken down by moderation, or expired by the cron, is not the
  // seller's to reactivate.
  if (listing.status !== 'active' && listing.status !== 'sold') {
    return NextResponse.json(
      { error: 'This listing can no longer be changed' },
      { status: 409 }
    )
  }

  const { error } = await service
    .from('listings')
    .update({ status: parsed.data.status })
    .eq('id', listing.id)

  if (error) {
    console.error('[listings:PATCH] update failed', error)
    return NextResponse.json({ error: 'Could not update listing' }, { status: 500 })
  }

  return NextResponse.json({ id: listing.id, status: parsed.data.status })
}
