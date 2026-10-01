import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Logo from '@/components/ui/Logo'
import ListingGallery from '@/components/listings/ListingGallery'
import MessageSellerButton from '@/components/listings/MessageSellerButton'
import MarkSoldButton from '@/components/listings/MarkSoldButton'
import { createClient } from '@/lib/supabase/server'
import { listingImageUrl } from '@/lib/images'
import { siteConfig } from '@/config/site'
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  formatPrice,
  formatLongDate,
  formatMonthYear,
  wasEdited,
} from '@/lib/listing-format'

// UUID guard: /listings/anything-at-all would otherwise reach Postgres and
// come back as a 22P02 invalid-uuid error rather than a clean 404.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SellerSchool = {
  schools_directory: { name: string; campus: string | null } | null
} | null

type ListingRow = {
  id: string
  user_id: string
  title: string
  description: string
  price: number | null
  category: string
  condition: string | null
  images: string[] | null
  pickup_hint: string | null
  status: string
  created_at: string
  updated_at: string
  users: {
    display_name: string
    username: string
    profile_photo: string | null
    created_at: string
    schools: SellerSchool
  } | null
}

// Note: contact_email is deliberately never selected here. Migration 009
// revoked it from anon/authenticated precisely so a seller's address can't
// leak through a public page — the contact flow (2.1) relays server-side.
const LISTING_SELECT = `
  id, user_id, title, description, price, category, condition, images,
  pickup_hint, status, created_at, updated_at,
  users!inner (
    display_name, username, profile_photo, created_at,
    schools ( schools_directory ( name, campus ) )
  )
`

async function getListing(id: string): Promise<ListingRow | null> {
  if (!UUID_PATTERN.test(id)) return null

  // RLS does the authorization: the public policy exposes active supply
  // listings, and migration 013 additionally lets an owner read their own.
  // A listing belonging to a suspended or soft-deleted seller disappears via
  // the !inner join, since the users policy hides those rows.
  const supabase = createClient()
  const { data } = await supabase
    .from('listings')
    .select(LISTING_SELECT)
    .eq('id', id)
    .maybeSingle<ListingRow>()

  return data ?? null
}

export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  const listing = await getListing(params.id)
  if (!listing) return { title: 'Listing not found' }

  const cover = listing.images?.[0]
  return {
    title: `${listing.title} · ${formatPrice(listing.price)} | ${siteConfig.name}`,
    description: listing.description.slice(0, 160),
    openGraph: {
      title: listing.title,
      description: listing.description.slice(0, 160),
      images: cover ? [listingImageUrl(cover)] : undefined,
    },
  }
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  const listing = await getListing(params.id)
  if (!listing || !listing.users) notFound()

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const seller = listing.users
  const isOwner = user?.id === listing.user_id
  const directory = seller.schools?.schools_directory ?? null
  const schoolName = directory
    ? [directory.name, directory.campus].filter(Boolean).join(' — ')
    : null
  const images = listing.images ?? []
  // Only meaningful while the listing is live: marking it sold bumps
  // updated_at via the DB trigger, which would otherwise brand every sold
  // listing as "Edited" when nothing about it was.
  const isEdited = listing.status === 'active' && wasEdited(listing.created_at, listing.updated_at)
  const isActive = listing.status === 'active'

  return (
    <div className="flex min-h-screen flex-col bg-brand-white">
      <header className="border-b border-brand-gray-200 px-6 py-4 md:px-10">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/" className="text-sm font-medium text-brand-blue hover:underline">
            Back to browsing
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 md:px-10">
        {!isActive && (
          <p className="mb-6 rounded-md bg-brand-gray-100 px-4 py-3 text-sm font-medium text-brand-gray-600">
            {listing.status === 'sold'
              ? 'This item has been marked as sold.'
              : 'This listing is no longer active.'}{' '}
            {isOwner && 'Only you can see it.'}
          </p>
        )}

        <div className="grid gap-8 md:grid-cols-2 md:gap-12">
          <ListingGallery images={images} title={listing.title} />

          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-brand-dark-brown">
                  {listing.title}
                </h1>
                {isEdited && (
                  <span className="mt-1 shrink-0 rounded-full bg-brand-gray-100 px-2.5 py-1 text-xs font-medium text-brand-gray-500">
                    Edited
                  </span>
                )}
              </div>

              <p className="font-display text-2xl font-bold text-brand-emerald">
                {formatPrice(listing.price)}
              </p>

              <div className="flex flex-wrap items-center gap-2 text-sm text-brand-gray-500">
                <span>{CATEGORY_LABELS[listing.category] ?? listing.category}</span>
                {listing.condition && (
                  <>
                    <span>·</span>
                    <span>{CONDITION_LABELS[listing.condition] ?? listing.condition}</span>
                  </>
                )}
                <span>·</span>
                <span>Posted {formatLongDate(listing.created_at)}</span>
              </div>
            </div>

            {/* whitespace-pre-line preserves the seller's line breaks. Rendered
                as plain text on purpose — no auto-linking, which would turn a
                description into a one-click phishing vector. */}
            <p className="whitespace-pre-line text-base leading-relaxed text-brand-gray-600">
              {listing.description}
            </p>

            {listing.pickup_hint && (
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-brand-dark-brown">Pickup</span>
                <span className="text-sm text-brand-gray-600">{listing.pickup_hint}</span>
              </div>
            )}

            <div className="rounded-lg border border-brand-gray-200 p-4">
              <Link href={`/u/${seller.username}`} className="flex items-center gap-3">
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-brand-gray-100">
                  {seller.profile_photo && (
                    <Image
                      src={seller.profile_photo}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  )}
                </span>
                <span className="flex flex-col">
                  {/* Real name leads, handle underneath — the Venmo pattern.
                      display_name is generated from first/last in the DB, so it
                      can't disagree with the name parts. */}
                  <span className="text-sm font-semibold text-brand-dark-brown hover:underline">
                    {seller.display_name}
                  </span>
                  <span className="text-xs text-brand-gray-500">@{seller.username}</span>
                  {schoolName && (
                    <span className="text-xs text-brand-gray-500">{schoolName}</span>
                  )}
                  <span className="text-xs text-brand-gray-400">
                    Member since {formatMonthYear(seller.created_at)}
                  </span>
                </span>
              </Link>
            </div>

            {isOwner ? (
              <div className="flex flex-wrap items-start gap-3">
                <Link
                  href={`/listings/${listing.id}/edit`}
                  className="rounded-md border border-brand-gray-200 px-6 py-3 text-sm font-semibold text-brand-dark-brown transition hover:border-brand-emerald hover:text-brand-emerald"
                >
                  Edit listing
                </Link>
                {/* Shown for sold listings too, so a seller whose buyer fell
                    through can relist rather than repost from scratch. */}
                {(isActive || listing.status === 'sold') && (
                  <MarkSoldButton listingId={listing.id} status={listing.status} />
                )}
              </div>
            ) : (
              isActive &&
              (user ? (
                <MessageSellerButton listingId={listing.id} />
              ) : (
                <Link
                  href="/sign-in"
                  className="rounded-md bg-brand-emerald px-6 py-4 text-center text-sm font-semibold text-brand-white transition hover:bg-brand-emerald-hover"
                >
                  Sign in to message seller
                </Link>
              ))
            )}

            <a
              href={`mailto:${siteConfig.moderationEmail}?subject=${encodeURIComponent(
                `Report listing ${listing.id}`
              )}`}
              className="text-xs font-medium text-brand-gray-400 hover:text-brand-gray-600 hover:underline"
            >
              Report this listing
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
