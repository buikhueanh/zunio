'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SubmitState = 'idle' | 'submitting' | 'error'

export default function SignInForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const canSubmit = email.trim().length > 0 && password.length > 0 && state !== 'submitting'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setState('submitting')
    setErrorMessage('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setState('error')
      setErrorMessage('Incorrect email or password.')
      return
    }

    router.push('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 w-full rounded-md bg-brand-emerald px-6 py-4 text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === 'submitting' ? 'Signing in...' : 'Sign in'}
      </button>

      {state === 'error' && (
        <p className="text-sm font-medium text-red-600">{errorMessage}</p>
      )}
    </form>
  )
}
