'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import SchoolCombobox from '@/components/ui/SchoolCombobox'
import type { SchoolSelection } from '@/lib/schools'
import { suggestUsername, isValidUsername, normalizeUsername } from '@/utils/username'

type SubmitState = 'idle' | 'submitting' | 'error'
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export default function SignUpForm() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [username, setUsername] = useState('')
  // Tracks whether the person has typed their own username. Until they do, the
  // field auto-follows their name; once they edit it, we stop overwriting what
  // they wrote.
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [school, setSchool] = useState<SchoolSelection>(null)
  const [state, setState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  // Auto-fill the username from the name until the person edits it themselves.
  useEffect(() => {
    if (usernameTouched) return
    setUsername(suggestUsername(firstName, lastName))
  }, [firstName, lastName, usernameTouched])

  // Debounced availability hint. This is advisory only — the unique index in
  // the database is what actually prevents duplicates, and the sign-up route
  // handles losing the race.
  useEffect(() => {
    const candidate = normalizeUsername(username)
    if (candidate.length === 0) {
      setUsernameStatus('idle')
      return
    }
    if (!isValidUsername(candidate)) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/username-available', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: candidate }),
        })
        const data = await res.json()
        setUsernameStatus(data.available ? 'available' : 'taken')
      } catch {
        setUsernameStatus('idle')
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [username])

  const canSubmit =
    firstName.trim().length >= 1 &&
    isValidUsername(normalizeUsername(username)) &&
    usernameStatus !== 'taken' &&
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
          first_name: firstName.trim(),
          last_name: lastName.trim() || null,
          username: normalizeUsername(username),
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
      <div className="flex gap-3">
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="First name"
          required
          maxLength={40}
          className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
        />
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Last name (optional)"
          maxLength={40}
          className="w-full rounded-md border border-brand-gray-200 bg-brand-white px-5 py-4 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="relative">
          <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-sm text-brand-gray-400">
            @
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsernameTouched(true)
              setUsername(e.target.value.toLowerCase())
            }}
            placeholder="username"
            required
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-md border border-brand-gray-200 bg-brand-white py-4 pl-9 pr-5 text-sm text-brand-dark-brown placeholder:text-brand-gray-400 outline-none transition focus:border-brand-emerald focus:ring-4 focus:ring-brand-emerald-light"
          />
        </div>
        <p className="px-1 text-xs text-brand-gray-400">
          {usernameStatus === 'checking' && 'Checking availability...'}
          {usernameStatus === 'available' && (
            <span className="font-medium text-brand-emerald">
              @{normalizeUsername(username)} is available
            </span>
          )}
          {usernameStatus === 'taken' && (
            <span className="font-medium text-red-600">That username is taken</span>
          )}
          {usernameStatus === 'invalid' && username.trim().length > 0 && (
            <span className="font-medium text-red-600">
              3–30 characters: letters, numbers, dots and underscores only
            </span>
          )}
          {usernameStatus === 'idle' &&
            'How other students find you. This can’t be changed later.'}
        </p>
      </div>

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
        {/* This field is the user's IDENTITY, not a browsing preference: the
            verification email is checked against this school's domain, so
            inviting people to "pick a feed" here would block real students. */}
        <p className="px-1 text-xs text-brand-gray-400">
          The school you actually attend — we check your school email against it. You can
          browse and sell at other campuses either way.
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
