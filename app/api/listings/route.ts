import { NextResponse } from 'next/server'
import { Filter } from 'bad-words'
import { createServiceClient } from '@/lib/supabase/server'
import { requireVerifiedSeller } from '@/lib/auth-guard'
import { listingSchema, MAX_ACTIVE_LISTINGS } from '@/lib/validations'

const BUCKET = 'listing-images'
const profanityFilter = new Filter()

export async function POST(request: Request) {
  // middleware.ts does not match /api/* — this is the real access check.
  const guard = await requireVerifiedSeller()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.failure.error }, { status: guard.failure.status })
  }
  const { userId, schoolId: sellerSchoolId } = guard.context

  const body = await request.json().catch(() => null)
  const parsed = listingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid listing', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { title, description, price, category, condition, pickup_hint, images } = parsed.data
  const requestedSchoolId = parsed.data.school_id

  // Titles surface in the public grid and get indexed by Google, so they carry
  // the reputational risk. Descriptions are deliberately not filtered —
  // bad-words matches substrings and would reject legitimate long text.
  if (profanityFilter.isProfane(title)) {
    return NextResponse.json(
      { error: 'Title contains inappropriate language' },
      { status: 400 }
    )
  }

  const serviceClient = createServiceClient()

  // Resolve which campus feed this listing belongs to. Defaults to the
  // seller's own school; an explicit choice must be a real, ACTIVE school —
  // otherwise a client could file listings into an unlaunched campus (where
  // they'd be invisible) or a nonexistent id.
  let listingSchoolId = sellerSchoolId
  if (requestedSchoolId && requestedSchoolId !== sellerSchoolId) {
    const { data: targetSchool, error: schoolError } = await serviceClient
      .from('schools')
      .select('id')
      .eq('id', requestedSchoolId)
      .eq('active', true)
      .maybeSingle()

    if (schoolError) {
      console.error('[listings] school lookup failed', schoolError)
      return NextResponse.json({ error: 'Could not create listing' }, { status: 500 })
    }
    if (!targetSchool) {
      return NextResponse.json(
        { error: 'You can only post to a school that has launched' },
        { status: 400 }
      )
    }
    listingSchoolId = targetSchool.id
  }

  // Every image must be an object this user actually uploaded. Without this,
  // `images` is just client-supplied text: a caller could point a "photo" at
  // any path (or another user's), and it would render in the public feed.
  if (images.length > 0) {
    const prefix = `${userId}/`
    if (!images.every((path) => path.startsWith(prefix) && !path.includes('..'))) {
      return NextResponse.json({ error: 'Invalid image reference' }, { status: 400 })
    }

    // Checked via the Storage API, not a query against storage.objects —
    // PostgREST does not expose the `storage` schema ("Invalid schema:
    // storage"), so a .schema('storage') query fails for every request,
    // including valid ones. info() returns an "Object not found" error for a
    // path that was never uploaded. At most MAX_LISTING_IMAGES paths, so the
    // per-path round trip is bounded.
    const results = await Promise.all(
      images.map((path) => serviceClient.storage.from(BUCKET).info(path))
    )
    if (results.some((r) => r.error || !r.data)) {
      return NextResponse.json({ error: 'Invalid image reference' }, { status: 400 })
    }
  }

  // Cap check is read-then-write, so parallel requests could theoretically
  // slip past it (worst case: a user ends up with a couple extra listings).
  // Accepted at MVP rather than adding row locking — see BUILDORDER 1.8.
  const { count, error: countError } = await serviceClient
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null)

  if (countError) {
    console.error('[listings] could not count active listings', countError)
    return NextResponse.json({ error: 'Could not create listing' }, { status: 500 })
  }

  if ((count ?? 0) >= MAX_ACTIVE_LISTINGS) {
    return NextResponse.json(
      {
        error: `You can have at most ${MAX_ACTIVE_LISTINGS} active listings. Mark one as sold to post another.`,
      },
      { status: 409 }
    )
  }

  const { data: listing, error: insertError } = await serviceClient
    .from('listings')
    .insert({
      // From the session, never the request body — otherwise a caller could
      // post listings as someone else.
      user_id: userId,
      // Where the item is sold — independent of the seller's own school,
      // which stays their verified identity (migration 017).
      school_id: listingSchoolId,
      title,
      description,
      price,
      category,
      condition: condition ?? null,
      pickup_hint: pickup_hint ?? null,
      images,
    })
    .select('id')
    .single()

  if (insertError || !listing) {
    console.error('[listings] insert failed', insertError)
    return NextResponse.json({ error: 'Could not create listing' }, { status: 500 })
  }

  return NextResponse.json({ id: listing.id }, { status: 201 })
}
