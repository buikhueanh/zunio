'use client'

import { useState, type FormEvent } from 'react'

type SubmitState = 'idle' | 'submitting' | 'sent' | 'error'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function AddSchoolEmailForm() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = isValidEmail(email) && state !== 'submitting'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/account/add-school-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      setState('sent')
    } catch {
      setState('error')
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  if (state === 'sent') {
    return (
      <div className="rounded-md border border-brand-emerald-light bg-brand-emerald-light px-5 py-4 text-sm font-medium text-brand-emerald">
        Check {email} for a verification link.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Your school email"
        required
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-md bg-brand-emerald px-6 py-4 text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'submitting' ? 'Sending...' : 'Send verification link'}
      </button>

      {state === 'error' && (
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      )}
    </form>
  )
}
