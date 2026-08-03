'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import SchoolCombobox from '@/components/ui/SchoolCombobox'
import type { SchoolSelection } from '@/lib/schools'

type SubmitState = 'idle' | 'submitting' | 'error'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function SignUpForm() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [school, setSchool] = useState<SchoolSelection>(null)
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit =
    displayName.trim().length >= 2 &&
    isValidEmail(email) &&
    password.length >= 6 &&
    school !== null &&
    'schoolId' in school &&
    state !== 'submitting'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit || !school || !('schoolId' in school)) return

    setState('submitting')
    setErrorMessage('')

    try {
      const res = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
          school_directory_id: school.schoolId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMessage(data.error ?? 'Something went wrong. Please try again.')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setState('error')
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Display name"
        required
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      <div className="flex flex-col gap-1">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
        />
        <p className="px-1 text-xs text-brand-gray-400">
          Have a school email? Use it to post listings right away. Any email works to browse
          and message sellers — add a school email later if you want to sell.
        </p>
      </div>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password (min. 6 characters)"
        required
        minLength={6}
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      <div className="flex flex-col gap-1">
        <SchoolCombobox value={school} onChange={setSchool} allowUnlisted={false} />
        <p className="px-1 text-xs text-brand-gray-400">
          This sets your default browsing feed — you can look at other schools anytime.
        </p>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 w-full rounded-md bg-brand-emerald px-6 py-4 text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'submitting' ? 'Creating account...' : 'Create account'}
      </button>

      {state === 'error' && (
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      )}
    </form>
  )
}
