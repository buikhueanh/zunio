'use client'

import { useState } from 'react'
import Link from 'next/link'
import Logo from '@/components/ui/Logo'

type ResendState = 'idle' | 'sending' | 'sent' | 'error'

export default function CheckEmailPage() {
  const [state, setState] = useState<ResendState>('idle')

  async function handleResend() {
    setState('sending')
    const res = await fetch('/api/auth/resend-verification', { method: 'POST' })
    setState(res.ok ? 'sent' : 'error')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream-light px-6 py-10">
      <div className="w-full max-w-md rounded-lg bg-brand-white p-8 text-center shadow-lg">
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-extrabold tracking-tight text-brand-dark-brown">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-brand-gray-500">
          We sent you a verification link when you signed up. Click it to unlock posting
          listings.
        </p>

        <button
          type="button"
          onClick={handleResend}
          disabled={state === 'sending'}
          className="mt-6 w-full rounded-md bg-brand-emerald px-6 py-4 text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === 'sending' ? 'Sending...' : 'Resend verification email'}
        </button>

        {state === 'sent' && (
          <p className="mt-3 text-sm font-medium text-brand-emerald">Verification email sent.</p>
        )}
        {state === 'error' && (
          <p className="mt-3 text-sm font-medium text-red-600">
            Something went wrong. Please try again in a moment.
          </p>
        )}

        <Link href="/" className="mt-6 block text-sm font-medium text-brand-blue hover:underline">
          Back to browsing
        </Link>
      </div>
    </div>
  )
}
