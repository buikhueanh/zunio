import type { SupabaseClient } from '@supabase/supabase-js'
import { listingImageUrl } from '@/lib/images'

export const MAX_MESSAGE_LENGTH = 1000
export const MIN_MESSAGE_LENGTH = 1

// Rate limits. CLAUDE.md's "3 contact requests per listing" was written for the
// email-relay design and doesn't map to chat — you'd exceed it in one ordinary
// back-and-forth. The structural equivalent is enforced instead by the UNIQUE
// (listing_id, buyer_id) constraint: one thread per listing per buyer.
//
// What still needs limiting is the actual spam shape: blasting many DIFFERENT
// sellers, and flooding one thread.
export const MAX_NEW_CONVERSATIONS_PER_HOUR = 5
export const MAX_MESSAGES_PER_HOUR = 60

// Don't email someone who is already reading the thread, and never more than
// once per this window per conversation.
export const NOTIFY_THROTTLE_MINUTES = 15

export type ConversationSummary = {
  id: string
  listingId: string
  listingTitle: string
  listingThumbnail: string | null
  otherPersonName: string
  otherPersonUsername: string
  lastMessageAt: string
  lastMessagePreview: string | null
  unread: boolean
}

export type ChatMessage = {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: string
}

type ConversationRow = {
  id: string
  listing_id: string
  buyer_id: string
  last_message_at: string
  listings: {
    title: string
    images: string[] | null
    user_id: string
    users: { display_name: string; username: string } | null
  } | null
  conversation_participants: Array<{
    user_id: string
    last_read_at: string | null
    users: { display_name: string; username: string } | null
  }>
  messages: Array<{ content: string; created_at: string }>
}

const CONVERSATION_SELECT = `
  id, listing_id, buyer_id, last_message_at,
  listings ( title, images, user_id, users ( display_name, username ) ),
  conversation_participants ( user_id, last_read_at, users ( display_name, username ) ),
  messages ( content, created_at )
`

/**
 * Conversations for the signed-in user. Runs through the caller's own client,
 * so RLS — not a WHERE clause — is what limits this to their threads.
 */
export async function fetchConversations(
  supabase: SupabaseClient,
  userId: string
): Promise<ConversationSummary[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(CONVERSATION_SELECT)
    .order('last_message_at', { ascending: false })
    .returns<ConversationRow[]>()

  if (error) {
    console.error('fetchConversations failed', error)
    return []
  }

  return (data ?? []).map((row) => {
    const me = row.conversation_participants.find((p) => p.user_id === userId)
    const other = row.conversation_participants.find((p) => p.user_id !== userId)
    const sorted = [...row.messages].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const latest = sorted[0] ?? null

    return {
      id: row.id,
      listingId: row.listing_id,
      listingTitle: row.listings?.title ?? 'Listing unavailable',
      listingThumbnail: row.listings?.images?.[0]
        ? listingImageUrl(row.listings.images[0])
        : null,
      otherPersonName: other?.users?.display_name ?? 'A student',
      otherPersonUsername: other?.users?.username ?? '',
      lastMessageAt: row.last_message_at,
      lastMessagePreview: latest?.content ?? null,
      unread: Boolean(
        latest &&
          (!me?.last_read_at ||
            new Date(latest.created_at).getTime() > new Date(me.last_read_at).getTime())
      ),
    }
  })
}

export async function fetchMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('fetchMessages failed', error)
    return []
  }

  return (data ?? []).map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    content: m.content,
    createdAt: m.created_at,
  }))
}

/** Only last_read_at is writable by the client — see migration 020. */
export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<void> {
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
}
