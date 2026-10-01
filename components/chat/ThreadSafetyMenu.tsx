'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Ban, Flag } from 'lucide-react'
import { siteConfig } from '@/config/site'
import { dropdownItem, cx } from '@/lib/ui-classes'

/**
 * Block and report, placed in the thread itself.
 *
 * This is where harassment is experienced, so it is where the remedy belongs —
 * burying it in account settings means the person who needs it most has to go
 * looking while the messages keep arriving.
 */
export default function ThreadSafetyMenu({
  username,
  displayName,
  conversationId,
  initiallyBlocked,
}: {
  username: string
  displayName: string
  conversationId: string
  initiallyBlocked: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [blocked, setBlocked] = useState(initiallyBlocked)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function toggleBlock() {
    setPending(true)
    setError('')

    const res = await fetch('/api/blocks', {
      method: blocked ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'Something went wrong')
      setPending(false)
      return
    }

    const { blocked: now } = await res.json()
    setBlocked(now)
    setPending(false)
    setOpen(false)
    router.refresh()
  }

  // Reporting goes to a monitored inbox rather than a table: moderation is
  // manual at MVP (CLAUDE.md), and a report nobody reads is worse than none.
  // The conversation id is prefilled so a report can actually be located.
  const reportHref = `mailto:${siteConfig.moderationEmail}?subject=${encodeURIComponent(
    `Report: conversation ${conversationId}`
  )}&body=${encodeURIComponent(
    `I'm reporting @${username} for a conversation on Zunio.\n\n` +
      `Conversation ID: ${conversationId}\n\n` +
      `What happened:\n`
  )}`

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Safety options for ${displayName}`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-brand-gray-500 transition hover:bg-brand-gray-100 hover:text-brand-dark-brown"
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-60 overflow-hidden rounded-md border border-brand-gray-200 bg-brand-white shadow-lg">
          <button
            type="button"
            onClick={toggleBlock}
            disabled={pending}
            className={cx(dropdownItem, 'flex items-center gap-2 text-brand-dark-brown disabled:opacity-50')}
          >
            <Ban className="h-4 w-4 shrink-0" aria-hidden />
            {pending ? 'Working...' : blocked ? `Unblock ${displayName}` : `Block ${displayName}`}
          </button>
          <a
            href={reportHref}
            className={cx(dropdownItem, 'flex items-center gap-2 text-brand-dark-brown')}
          >
            <Flag className="h-4 w-4 shrink-0" aria-hidden />
            Report this conversation
          </a>
        </div>
      )}

      {error && (
        <p className="absolute right-0 top-full mt-1 w-60 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
