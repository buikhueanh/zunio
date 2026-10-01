import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { CircleCheckBig, ExternalLink } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import SiteFooter from '@/components/ui/SiteFooter'
import ListingCard from '@/components/browse/ListingCard'
import { createClient } from '@/lib/supabase/server'
import { listingImageUrl } from '@/lib/images'
import { formatMonthYear } from '@/lib/listing-format'
import { isAllowedSocialUrl, socialLabel } from '@/lib/validations'
import { USERNAME_PATTERN } from '@/utils/username'
import type { ListingSummary } from '@/lib/listings'
import { siteConfig } from '@/config/site'

type ProfileRow = {
  id: string
  display_name: string
  username: string
  bio: string | null
  social_url: string | null
  created_at: string
  is_seller_verified: boolean
  schools: { schools_directory: { name: string; campus: string | null } | null } | null
}

type ListingRow = {
  id: string
  title: string
  price: number | null
  images: string[] | null
  category: string
  condition: string | null
  pickup_hint: string | null
  created_at: string
  updated_at: string
}

// contact_email is absent by construction — migration 014's grant doesn't give
// anon/authenticated the column at all, so a public page cannot select it even
// by mistake.
const PROFILE_SELECT = `
  id, display_name, username, bio, social_url, created_at, is_seller_verified,
  schools ( schools_directory ( name, campus ) )
`

async function getProfile(username: string) {
  // Reject anything that isn't username-shaped before querying, so a junk path
  // is a clean 404 rather than a database round trip.
  const candidate = username.trim().toLowerCase()
  if (!USERNAME_PATTERN.test(candidate)) return null

  const supabase = createClient()

  // RLS ("public read user profiles") already excludes suspended and
  // soft-deleted accounts, so those 404 here without an explicit check.
  // ilike makes /u/ZunioTestSeller resolve the same as the lowercase form —
  // people share profile links with whatever casing they typed.
  const { data: profile } = await supabase
    .from('users')
    .select(PROFILE_SELECT)
    .ilike('username', candidate)
    .maybeSingle<ProfileRow>()

  if (!profile) return null

  // Their active listings across every campus they've sold into — a profile is
  // about the person, not one feed.
  const { data: listings } = await supabase
    .from('listings')
    .select('id, title, price, images, category, condition, pickup_hint, created_at, updated_at')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .eq('listing_type', 'supply')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<ListingRow[]>()

  return { profile, listings: listings ?? [] }
}

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
  const result = await getProfile(params.username)
  if (!result) return { title: 'Profile not found' }

  const school = result.profile.schools?.schools_directory?.name
  return {
    title: `${result.profile.display_name} (@${result.profile.username}) | ${siteConfig.name}`,
    description: school
      ? `${result.profile.display_name} sells on Zunio at ${school}.`
      : `${result.profile.display_name} on Zunio.`,
  }
}

export default async function SellerProfilePage({
  params,
}: {
  params: { username: string }
}) {
  const result = await getProfile(params.username)
  if (!result) notFound()

  const { profile, listings } = result
  const directory = profile.schools?.schools_directory ?? null
  const schoolName = directory
    ? [directory.name, directory.campus].filter(Boolean).join(' — ')
    : null

  // Re-checked here rather than trusted: an unvalidated href is a one-click
  // redirect to anywhere, and this value is user-supplied.
  const showSocial = isAllowedSocialUrl(profile.social_url)

  const cards: ListingSummary[] = listings.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    thumbnail: l.images?.[0] ? listingImageUrl(l.images[0]) : null,
    category: l.category,
    condition: l.condition,
    created_at: l.created_at,
    updated_at: l.updated_at,
    seller_name: profile.display_name,
    seller_slug: profile.username,
    // Already stated in the header — repeating it on every card is noise.
    seller_school_name: null,
    pickup_hint: l.pickup_hint,
    seller_verified: profile.is_seller_verified,
  }))

  const initials = profile.display_name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream-light">
      <header className="border-b border-brand-gray-200 bg-brand-white px-6 py-4 md:px-10">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
            Back to browsing
          </Link>
        </div>
      </header>

      <main className="w-full flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-7xl">
          <div className="flex flex-col gap-4 rounded-lg border border-brand-gray-200 bg-brand-white p-6 sm:flex-row sm:items-start sm:gap-6">
            {/* Initials rather than next/image: profile_photo is always null
                until photo upload ships, and next.config only allows the
                listing-images path — an avatar from anywhere else would throw
                at render rather than just fail to load. */}
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-emerald-light font-display text-xl font-bold text-brand-emerald">
              {initials || '?'}
            </span>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold tracking-tight text-brand-dark-brown">
                  {profile.display_name}
                </h1>
                {profile.is_seller_verified && (
                  <span className="flex items-center gap-1 rounded-md bg-brand-blue px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand-white">
                    <CircleCheckBig className="h-3 w-3" aria-hidden />
                    Verified student
                  </span>
                )}
              </div>

              <p className="text-sm text-brand-gray-500">@{profile.username}</p>
              {schoolName && <p className="text-sm text-brand-gray-600">{schoolName}</p>}
              <p className="text-xs text-brand-gray-400">
                Member since {formatMonthYear(profile.created_at)}
              </p>

              {profile.bio && (
                <p className="mt-2 max-w-xl whitespace-pre-line text-sm leading-relaxed text-brand-gray-600">
                  {profile.bio}
                </p>
              )}

              {showSocial && profile.social_url && (
                <a
                  href={profile.social_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex w-fit items-center gap-1.5 text-sm font-medium text-brand-blue hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {socialLabel(profile.social_url)}
                </a>
              )}
            </div>
          </div>

          <h2 className="mt-10 font-display text-xl font-bold tracking-tight text-brand-dark-brown">
            Listings
            <span className="ml-2 text-sm font-normal text-brand-gray-500">
              {listings.length} active
            </span>
          </h2>

          {cards.length === 0 ? (
            <p className="py-14 text-center text-sm text-brand-gray-500">
              {profile.display_name} has no active listings right now.
            </p>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
              {cards.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
