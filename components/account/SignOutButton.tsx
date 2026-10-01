'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // refresh() re-runs the server components so the header, banner and browse
    // page all re-render as logged-out; push() alone would leave them showing
    // stale signed-in state from the cached render.
    router.push('/')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="rounded-md border border-brand-gray-200 px-6 py-3 text-sm font-semibold text-brand-dark-brown transition hover:border-brand-emerald hover:text-brand-emerald disabled:cursor-not-allowed disabled:opacity-50"
    >
      {signingOut ? 'Signing out...' : 'Sign out'}
    </button>
  )
}
