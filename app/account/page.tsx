import Link from 'next/link'
import { redirect } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import SiteFooter from '@/components/ui/SiteFooter'
import SignOutButton from '@/components/account/SignOutButton'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { formatMonthYear } from '@/lib/listing-format'

export const metadata = { title: 'Account | Zunio' }

type Profile = {
  first_name: string
  last_name: string | null
  username: string
  display_name: string
  contact_email: string | null
  is_seller_verified: boolean
  email_verified_at: string | null
  created_at: string
  schools: { schools_directory: { name: string; campus: string | null } | null } | null
}

export default async function AccountPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Middleware already gates /account/*, but a page that assumes a session
  // without checking would crash rather than redirect if that ever changed.
  if (!user) redirect('/sign-in')

  // Service role on purpose: contact_email is revoked from anon/authenticated
  // (migration 009) so a seller's address can't be harvested, which also means
  // the normal client can't read the user's OWN address. Migration 009's note
  // says to serve it from a server route with the service role rather than
  // re-granting the column — this is that.
  const service = createServiceClient()
  const { data: profile } = await service
    .from('users')
    .select(
      'first_name, last_name, username, display_name, contact_email, is_seller_verified, email_verified_at, created_at, schools(schools_directory(name, campus))'
    )
    .eq('id', user.id)
    .maybeSingle<Profile>()

  if (!profile) redirect('/sign-in')

  const directory = profile.schools?.schools_directory ?? null
  const schoolName = directory
    ? [directory.name, directory.campus].filter(Boolean).join(' — ')
    : 'Not set'

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Name', value: profile.display_name },
    { label: 'Username', value: `@${profile.username}` },
    { label: 'School', value: schoolName },
    { label: 'Email', value: profile.contact_email ?? '—' },
    { label: 'Member since', value: formatMonthYear(profile.created_at) },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream-light">
      <header className="border-b border-brand-gray-200 bg-brand-white px-6 py-4 md:px-10">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
            Back to browsing
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 md:px-10">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-dark-brown">
          Account
        </h1>

        <div className="mt-6 rounded-lg border border-brand-gray-200 bg-brand-white p-6">
          <dl className="flex flex-col divide-y divide-brand-gray-200">
            {rows.map((row) => (
              <div key={row.label} className="flex flex-wrap justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <dt className="text-sm text-brand-gray-500">{row.label}</dt>
                <dd className="text-sm font-medium text-brand-dark-brown">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 rounded-lg border border-brand-gray-200 bg-brand-white p-6">
          <h2 className="text-sm font-semibold text-brand-dark-brown">Selling</h2>
          {profile.is_seller_verified ? (
            <p className="mt-2 text-sm text-brand-gray-600">
              Your school email is verified — you can post listings.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-brand-gray-600">
                {profile.email_verified_at
                  ? 'Verify an email that matches your school’s domain to post listings.'
                  : 'Verify your email address to get started.'}
              </p>
              <Link
                href={profile.email_verified_at ? '/account/add-school-email' : '/check-email'}
                className="mt-3 inline-block text-sm font-medium text-brand-blue hover:underline"
              >
                {profile.email_verified_at ? 'Add school email' : 'Resend verification'}
              </Link>
            </>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href="/listings/new" className="font-medium text-brand-blue hover:underline">
              Post a listing
            </Link>
            <Link href="/messages" className="font-medium text-brand-blue hover:underline">
              Messages
            </Link>
          </div>
        </div>

        {/* Editing name, contact email, school, bio and photo is item 2.6 —
            this page exists now because the header linked to /account and 404'd,
            and because there was no way to sign out anywhere in the app. */}
        <p className="mt-6 text-xs text-brand-gray-400">
          Editing your profile is coming soon.
        </p>

        <div className="mt-6">
          <SignOutButton />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
