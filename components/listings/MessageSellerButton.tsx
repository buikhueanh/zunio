'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function MessageSellerButton({ listingId }: { listingId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'starting'>('idle')
  const [error, setError] = useState('')

  async function handleClick() {
    setState('starting')
    setError('')

    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_id: listingId }),
    })

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.error ?? 'Could not start conversation')
      setState('idle')
      return
    }

    // Resumes the existing thread if there already is one — the route returns
    // the same conversation rather than creating a duplicate.
    const { id } = await res.json()
    router.push(`/messages/${id}`)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={state === 'starting'}
        className="rounded-md bg-brand-emerald px-6 py-4 text-center text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'starting' ? 'Opening...' : 'Message seller'}
      </button>
      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}
