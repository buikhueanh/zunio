import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const bodySchema = z.object({ username: z.string().trim().toLowerCase().min(1) })

/**
 * Block / unblock another user.
 *
 * Identified by username rather than id so the client never has to hold
 * someone's internal id, and so the thread UI can act on what it already
 * displays.
 *
 * Responses are deliberately uniform: blocking a username that does not exist
 * returns the same success as blocking one that does. Otherwise this endpoint
 * becomes a username-enumeration oracle for anyone with an account.
 */
async function resolveTarget(username: string) {
  const service = createServiceClient()
  const { data } = await service
    .from('users')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  return data?.id ?? null
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const targetId = await resolveTarget(parsed.data.username)
  if (!targetId || targetId === user.id) {
    // Same shape as success — see the enumeration note above. Self-blocking is
    // also rejected by a CHECK constraint (migration 021); this just avoids a
    // pointless round trip.
    return NextResponse.json({ blocked: true })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('blocked_users')
    .upsert({ blocker_id: user.id, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' })

  if (error) {
    console.error('[blocks] insert failed', error)
    return NextResponse.json({ error: 'Could not block this person' }, { status: 500 })
  }

  return NextResponse.json({ blocked: true })
}

export async function DELETE(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'You must be signed in' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const targetId = await resolveTarget(parsed.data.username)
  if (!targetId) return NextResponse.json({ blocked: false })

  const service = createServiceClient()
  const { error } = await service
    .from('blocked_users')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', targetId)

  if (error) {
    console.error('[blocks] delete failed', error)
    return NextResponse.json({ error: 'Could not unblock this person' }, { status: 500 })
  }

  return NextResponse.json({ blocked: false })
}
