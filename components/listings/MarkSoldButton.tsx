'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { button, cx } from '@/lib/ui-classes'

/**
 * Owner-only control to close or reopen a listing.
 *
 * Reopening exists because sales fall through — without it, a seller whose
 * buyer never showed up would have to delete and repost, losing the listing's
 * age and any conversations attached to it.
 */
export default function MarkSoldButton({
  listingId,
  status,
}: {
  listingId: string
  status: string
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isSold = status === 'sold'
  const nextStatus = isSold ? 'active' : 'sold'

  async function handleClick() {
    setSaving(true)
    setError('')

    const res = await fetch(`/api/listings/${listingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'Could not update listing')
      setSaving(false)
      return
    }

    // refresh() re-runs the server component so the status banner, the button
    // label and the buyer-facing visibility all update together.
    router.refresh()
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className={cx(
          isSold ? 'rounded-full border-[1.5px] border-brand-gray-300 px-5 py-2.5 text-sm font-semibold text-brand-dark-brown transition hover:border-brand-emerald hover:text-brand-emerald disabled:opacity-50' : button.primary
        )}
      >
        {saving
          ? 'Saving...'
          : isSold
            ? 'Relist this item'
            : 'Mark as sold'}
      </button>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}
