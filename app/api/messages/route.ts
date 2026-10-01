import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendMessageNotification } from '@/lib/resend'
import {
  MAX_MESSAGE_LENGTH,
  MIN_MESSAGE_LENGTH,
  MAX_MESSAGES_PER_HOUR,
  NOTIFY_THROTTLE_MINUTES,
} from '@/lib/chat'

const bodySchema = z.object({
  conversation_id: z.string().uuid(),
  content: z.string().trim().min(MIN_MESSAGE_LENGTH).max(MAX_MESSAGE_LENGTH),
})

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
    return NextResponse.json({ error: 'Message must be 1–1000 characters' }, { status: 400 })
  }
  const { conversation_id, content } = parsed.data

  const service = createServiceClient()

  const { data: profile } = await service
    .from('users')
    .select('id, display_name, is_suspended, deleted_at, email_verified_at')
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
      { error: 'Verify your email address before messaging' },
      { status: 403 }
    )
  }

  // Membership is authorization here. Checked explicitly rather than leaning on
  // RLS, because this route writes with the service role, which bypasses it.
  const { data: participants } = await service
    .from('conversation_participants')
    .select('user_id, last_read_at, last_notified_at')
    .eq('conversation_id', conversation_id)

  const me = participants?.find((p) => p.user_id === user.id)
  const recipient = participants?.find((p) => p.user_id !== user.id)

  if (!me || !recipient) {
    // Same response for "no such conversation" and "not yours", so this can't
    // be used to discover which conversation ids exist.
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await service
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('sender_id', user.id)
    .gte('created_at', hourAgo)

  if ((count ?? 0) >= MAX_MESSAGES_PER_HOUR) {
    return NextResponse.json(
      { error: 'You are sending messages too quickly. Try again later.' },
      { status: 429 }
    )
  }

  const { data: message, error: insertError } = await service
    .from('messages')
    .insert({ conversation_id, sender_id: user.id, content })
    .select('id, conversation_id, sender_id, content, created_at')
    .single()

  if (insertError || !message) {
    console.error('[messages] insert failed', insertError)
    return NextResponse.json({ error: 'Could not send message' }, { status: 500 })
  }

  // The message is saved and already broadcast over Realtime at this point.
  // Notification is best-effort from here on: a failed email must never turn a
  // delivered message into an error the sender sees.
  void notifyRecipient({
    service,
    conversationId: conversation_id,
    recipientId: recipient.user_id,
    recipientLastReadAt: recipient.last_read_at,
    recipientLastNotifiedAt: recipient.last_notified_at,
    senderName: profile.display_name,
    content,
  })

  return NextResponse.json({ message }, { status: 201 })
}

type NotifyArgs = {
  service: ReturnType<typeof createServiceClient>
  conversationId: string
  recipientId: string
  recipientLastReadAt: string | null
  recipientLastNotifiedAt: string | null
  senderName: string
  content: string
}

async function notifyRecipient({
  service,
  conversationId,
  recipientId,
  recipientLastReadAt,
  recipientLastNotifiedAt,
  senderName,
  content,
}: NotifyArgs) {
  try {
    const now = Date.now()

    // Don't email someone who is actively reading the thread — they can see the
    // message arrive in real time.
    const readRecently =
      recipientLastReadAt &&
      now - new Date(recipientLastReadAt).getTime() < NOTIFY_THROTTLE_MINUTES * 60 * 1000
    if (readRecently) return

    // And never more than once per window, so a rapid back-and-forth doesn't
    // produce a dozen emails (and burn the Resend quota sign-up depends on).
    const notifiedRecently =
      recipientLastNotifiedAt &&
      now - new Date(recipientLastNotifiedAt).getTime() < NOTIFY_THROTTLE_MINUTES * 60 * 1000
    if (notifiedRecently) return

    const { data: recipient } = await service
      .from('users')
      .select('contact_email')
      .eq('id', recipientId)
      .maybeSingle()

    if (!recipient?.contact_email) return

    const { data: conversation } = await service
      .from('conversations')
      .select('listings(title)')
      .eq('id', conversationId)
      .maybeSingle<{ listings: { title: string } | null }>()

    await sendMessageNotification({
      to: recipient.contact_email,
      senderName,
      listingTitle: conversation?.listings?.title ?? 'your listing',
      preview: content,
      conversationId,
    })

    // Stamped only after a confirmed send, so a failure stays retryable rather
    // than silently suppressing the next notification.
    await service
      .from('conversation_participants')
      .update({ last_notified_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', recipientId)
  } catch (err) {
    console.error('[messages] notification failed', { conversationId, recipientId, err })
  }
}
