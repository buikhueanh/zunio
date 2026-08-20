'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MAX_MESSAGE_LENGTH, type ChatMessage } from '@/lib/chat'

interface MessageThreadProps {
  conversationId: string
  currentUserId: string
  initialMessages: ChatMessage[]
}

export default function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Live updates. Two things are load-bearing here:
  //   1. realtime.setAuth(token) — WITHOUT it the socket connects as anon, RLS
  //      filters everything out, and the channel still reports SUBSCRIBED while
  //      silently delivering nothing. Verified the hard way.
  //   2. The server-side RLS policy is what scopes delivery: Postgres Changes
  //      evaluates it per subscriber, so only conversation participants receive
  //      these rows.
  useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    function mergeMessages(incoming: ChatMessage[]) {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id))
        const added = incoming.filter((m) => !seen.has(m.id))
        if (added.length === 0) return prev
        return [...prev, ...added].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )
      })
    }

    // Pull anything that arrived while the socket was down. A dropped
    // connection (laptop sleep, wifi change, tab backgrounded) otherwise leaves
    // the thread looking current while silently missing messages — the user has
    // no way to know they're seeing a stale conversation.
    async function backfill() {
      const { data } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at')
        .eq('conversation_id', conversationId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (cancelled || !data) return
      mergeMessages(
        data.map((m) => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          content: m.content,
          createdAt: m.created_at,
        }))
      )
    }

    // Access tokens expire (~1h). The socket authenticates once at subscribe
    // time, so without re-authing on refresh it keeps a stale token and
    // delivery stops — silently, since the channel stays open.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        supabase.realtime.setAuth(session.access_token)
      }
    })

    async function subscribe() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session || cancelled) return

      await supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`conversation:${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string
              conversation_id: string
              sender_id: string
              content: string
              created_at: string
            }
            setMessages((prev) =>
              // The sender already appended this optimistically, and a
              // reconnect can replay rows — dedupe on id either way.
              prev.some((m) => m.id === row.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: row.id,
                      conversationId: row.conversation_id,
                      senderId: row.sender_id,
                      content: row.content,
                      createdAt: row.created_at,
                    },
                  ]
            )
          }
        )
        // Fires on first subscribe AND after any automatic reconnect, so the
        // backfill closes whatever gap the disconnection opened.
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') backfill()
        })
    }

    subscribe()
    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
      if (channel) supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending) return

    setSending(true)
    setError('')

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, content }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'Could not send message')
      setSending(false)
      return
    }

    const { message } = await res.json()
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      content: message.content,
      createdAt: message.created_at,
    }]))
    setDraft('')
    setSending(false)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-1 py-4">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-brand-gray-400">
            No messages yet. Say hello.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.senderId === currentUserId
            return (
              <li
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm ${
                    mine
                      ? 'bg-brand-emerald text-brand-white'
                      : 'bg-brand-gray-100 text-brand-dark-brown'
                  }`}
                >
                  {m.content}
                </div>
              </li>
            )
          })}
        </ul>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex flex-col gap-2 border-t border-brand-gray-200 pt-3">
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            rows={2}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Write a message..."
            className="flex-1 resize-none rounded-md border border-brand-gray-200 bg-brand-white px-4 py-3 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="rounded-md bg-brand-emerald px-5 py-3 text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}
