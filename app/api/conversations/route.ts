import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { MAX_NEW_CONVERSATIONS_PER_HOUR } from '@/lib/chat'

const bodySchema = z.object({ listing_id: z.string().uuid() })

/**
 * Opens (or resumes) the conversation between the signed-in buyer and a
 * listing's seller.
 *
 * Messaging deliberately does NOT require is_seller_verified — buying and
 * contacting stay open to anyone, per DECISIONS.md. It does require a verified
 * email address: this endpoint causes our domain to send mail to a student, so
 * a throwaway unverified account must not be able to trigger it.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: profile } = await service
    .from('users')
    .select('id, email_verified_at, is_suspended, deleted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.deleted_at) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }
  if (profile.is_suspended) {
    return NextResponse.json({ error: 'This account is suspended' }, { status: 403 })
  }
  if (!profile.email_verified_at) {
    return NextResponse.json(
      { error: 'Verify your email address before messaging sellers' },
      { status: 403 }
    )
  }

  const { data: listing } = await service
    .from('listings')
    .select('id, user_id, status, deleted_at')
    .eq('id', parsed.data.listing_id)
    .maybeSingle()

  // Same generic message for missing and unavailable listings, so this can't
  // be used to probe which listing ids exist.
  if (!listing || listing.deleted_at || listing.status !== 'active') {
    return NextResponse.json({ error: 'This listing is not available' }, { status: 404 })
  }
  if (listing.user_id === user.id) {
    return NextResponse.json({ error: 'This is your own listing' }, { status: 400 })
  }

  // Blocking is checked in BOTH directions: a seller who blocked this buyer
  // shouldn't receive their messages, and a buyer who blocked the seller
  // shouldn't be pulled into a thread with them. Table is empty until the v2
  // blocking UI ships, but the data layer is ready and the check is cheap.
  const { data: blocks } = await service
    .from('blocked_users')
    .select('blocker_id')
    .or(
      `and(blocker_id.eq.${listing.user_id},blocked_id.eq.${user.id}),` +
        `and(blocker_id.eq.${user.id},blocked_id.eq.${listing.user_id})`
    )

  if (blocks && blocks.length > 0) {
    return NextResponse.json({ error: 'This listing is not available' }, { status: 404 })
  }

  // Resume an existing thread. The UNIQUE (listing_id, buyer_id) constraint
  // from migration 019 is what actually guarantees one thread per listing per
  // buyer — this lookup just avoids relying on a constraint violation.
  const { data: existing } = await service
    .from('conversations')
    .select('id')
    .eq('listing_id', listing.id)
    .eq('buyer_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ id: existing.id })
  }

  // Rate limit only NEW conversations — that's the spam shape (blasting many
  // sellers). Messages within an existing thread are limited separately.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await service
    .from('conversations')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', user.id)
    .gte('created_at', hourAgo)

  if ((count ?? 0) >= MAX_NEW_CONVERSATIONS_PER_HOUR) {
    return NextResponse.json(
      { error: 'You have started too many conversations recently. Try again later.' },
      { status: 429 }
    )
  }

  const { data: conversation, error: convoError } = await service
    .from('conversations')
    .insert({ listing_id: listing.id, buyer_id: user.id })
    .select('id')
    .single()

  if (convoError || !conversation) {
    // 23505 = someone opened the same thread concurrently; return theirs.
    if (convoError?.code === '23505') {
      const { data: raced } = await service
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('buyer_id', user.id)
        .maybeSingle()
      if (raced) return NextResponse.json({ id: raced.id })
    }
    console.error('[conversations] insert failed', convoError)
    return NextResponse.json({ error: 'Could not start conversation' }, { status: 500 })
  }

  // Both participants inserted server-side: no user-scoped RLS policy could
  // permit a buyer to insert a row for the seller.
  const { error: partError } = await service.from('conversation_participants').insert([
    { conversation_id: conversation.id, user_id: user.id },
    { conversation_id: conversation.id, user_id: listing.user_id },
  ])

  if (partError) {
    // Without both participant rows the thread is unreachable through RLS —
    // an orphan nobody can open. Roll it back rather than leave it.
    await service.from('conversations').delete().eq('id', conversation.id)
    console.error('[conversations] participants insert failed', partError)
    return NextResponse.json({ error: 'Could not start conversation' }, { status: 500 })
  }

  return NextResponse.json({ id: conversation.id }, { status: 201 })
}
