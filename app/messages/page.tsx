import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/server'
import { fetchConversations } from '@/lib/chat'
import { formatShortDate } from '@/lib/listing-format'

export const metadata = { title: 'Messages | Zunio' }

export default async function MessagesPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // RLS scopes this to the caller's own conversations.
  const conversations = await fetchConversations(supabase, user.id)

  return (
    <div className="flex min-h-screen flex-col bg-brand-white">
      <header className="border-b border-brand-gray-200 px-6 py-4 md:px-10">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
            Back to browsing
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 md:px-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-dark-brown">
          Messages
        </h1>

        {conversations.length === 0 ? (
          <p className="py-16 text-center text-sm text-brand-gray-500">
            No conversations yet. Message a seller from any listing to start one.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col divide-y divide-brand-gray-200 border-y border-brand-gray-200">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link href={`/messages/${c.id}`} className="flex items-center gap-3 py-4">
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-brand-gray-100">
                    {c.listingThumbnail && (
                      <Image
                        src={c.listingThumbnail}
                        alt=""
                        fill
                        sizes="48px"
                        className="object-cover"
                      />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-sm ${
                          c.unread
                            ? 'font-bold text-brand-dark-brown'
                            : 'font-semibold text-brand-dark-brown'
                        }`}
                      >
                        {c.otherPersonName}
                      </span>
                      <span className="shrink-0 text-xs text-brand-gray-400">
                        {formatShortDate(c.lastMessageAt)}
                      </span>
                    </span>
                    <span className="truncate text-xs text-brand-gray-500">
                      {c.listingTitle}
                    </span>
                    {c.lastMessagePreview && (
                      <span
                        className={`truncate text-xs ${
                          c.unread ? 'font-medium text-brand-dark-brown' : 'text-brand-gray-400'
                        }`}
                      >
                        {c.lastMessagePreview}
                      </span>
                    )}
                  </span>
                  {c.unread && (
                    <span
                      aria-label="Unread"
                      className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-emerald"
                    />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
