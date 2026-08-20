import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import MessageThread from '@/components/chat/MessageThread'
import { createClient } from '@/lib/supabase/server'
import { fetchMessages, markConversationRead } from '@/lib/chat'
import { listingImageUrl } from '@/lib/images'
import { formatPrice } from '@/lib/listing-format'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ConversationDetail = {
  id: string
  listing_id: string
  listings: { title: string; price: number | null; images: string[] | null } | null
  conversation_participants: Array<{
    user_id: string
    users: { display_name: string; username: string } | null
  }>
}

export default async function ThreadPage({ params }: { params: { id: string } }) {
  if (!UUID_PATTERN.test(params.id)) notFound()

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // No explicit ownership check needed: RLS only returns this row to a
  // participant, so a non-participant simply gets nothing and 404s.
  const { data: conversation } = await supabase
    .from('conversations')
    .select(
      'id, listing_id, listings(title, price, images), conversation_participants(user_id, users(display_name, username))'
    )
    .eq('id', params.id)
    .maybeSingle<ConversationDetail>()

  if (!conversation) notFound()

  const other = conversation.conversation_participants.find((p) => p.user_id !== user.id)
  const messages = await fetchMessages(supabase, conversation.id)

  // Opening the thread clears the unread state and suppresses the email
  // notification while they're actively reading.
  await markConversationRead(supabase, conversation.id, user.id)

  const thumbnail = conversation.listings?.images?.[0]

  return (
    <div className="flex h-screen flex-col bg-brand-white">
      <header className="border-b border-brand-gray-200 px-6 py-4 md:px-10">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/messages" className="text-sm font-medium text-brand-blue hover:underline">
            All messages
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-6 py-4 md:px-10">
        <Link
          href={`/listings/${conversation.listing_id}`}
          className="flex items-center gap-3 rounded-lg border border-brand-gray-200 p-3 transition hover:border-brand-emerald"
        >
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-brand-gray-100">
            {thumbnail && (
              <Image
                src={listingImageUrl(thumbnail)}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            )}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-brand-dark-brown">
              {conversation.listings?.title ?? 'Listing unavailable'}
            </span>
            <span className="text-xs text-brand-emerald">
              {conversation.listings ? formatPrice(conversation.listings.price) : ''}
            </span>
          </span>
        </Link>

        <p className="mt-3 text-sm font-semibold text-brand-dark-brown">
          {other?.users?.display_name ?? 'A student'}
          {other?.users?.username && (
            <span className="ml-1.5 font-normal text-brand-gray-500">
              @{other.users.username}
            </span>
          )}
        </p>

        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <MessageThread
            conversationId={conversation.id}
            currentUserId={user.id}
            initialMessages={messages}
          />
        </div>
      </div>
    </div>
  )
}
