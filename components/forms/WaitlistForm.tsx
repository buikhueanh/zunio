'use client'

import { useState, type FormEvent } from 'react'
import SchoolCombobox from '@/components/ui/SchoolCombobox'
import type { SchoolSelection } from '@/lib/schools'

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function WaitlistForm() {
  const [email, setEmail] = useState('')
  const [school, setSchool] = useState<SchoolSelection>(null)
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = isValidEmail(email) && school !== null && state !== 'submitting'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !school) return

    setState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          school_id: 'schoolId' in school ? school.schoolId : null,
          school_name_raw: 'schoolNameRaw' in school ? school.schoolNameRaw : null,
        }),
      })

      if (!res.ok) throw new Error('request_failed')
      setState('success')
    } catch {
      setState('error')
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  if (state === 'success') {
    return (
      <div className="rounded-md border border-brand-emerald-light bg-brand-emerald-light px-5 py-4 text-sm font-medium text-brand-emerald">
        You&apos;re on the list. We&apos;ll email you the moment your school launches.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter your email"
        required
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      <SchoolCombobox value={school} onChange={setSchool} />

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 w-full rounded-md bg-brand-emerald px-6 py-4 text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'submitting' ? 'Joining...' : 'Join the waitlist'}
      </button>

      {state === 'error' && (
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      )}
    </form>
  )
}
