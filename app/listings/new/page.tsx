import Link from 'next/link'
import Logo from '@/components/ui/Logo'
import ListingForm from '@/components/forms/ListingForm'
import { createClient } from '@/lib/supabase/server'

export default async function NewListingPage() {
  // The seller's own school seeds the campus selector's default. Middleware
  // already guarantees a verified seller reaches this page.
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('users').select('school_id').eq('id', user.id).maybeSingle()
    : { data: null }

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream-light px-6 py-10">
      <div className="mx-auto w-full max-w-2xl flex-1">
        <Link href="/">
          <Logo size="sm" />
        </Link>

        <h1 className="mt-8 font-display text-3xl font-extrabold tracking-tight text-brand-dark-brown">
          Post a listing
        </h1>
        <p className="mt-2 text-sm text-brand-gray-500">
          Sell to verified students at your school.
        </p>

        <div className="mt-8 rounded-lg bg-brand-white p-6 shadow-sm md:p-8">
          <ListingForm defaultSchoolId={profile?.school_id ?? null} />
        </div>
      </div>
    </div>
  )
}
