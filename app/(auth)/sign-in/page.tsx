import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import SignInForm from '@/components/forms/SignInForm'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream-light px-6 py-10">
      <div className="w-full max-w-md rounded-lg bg-brand-white p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <Logo size="sm" />
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-dark-brown">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-brand-gray-500">Sign in to your account.</p>
          </div>
        </div>

        <SignInForm />

        <p className="mt-6 text-center text-sm text-brand-gray-500">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="font-medium text-brand-emerald hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
