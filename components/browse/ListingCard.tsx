import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Check } from 'lucide-react'
import type { ListingSummary } from '@/lib/listings'
import { badge, chip, cx } from '@/lib/ui-classes'
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  formatPrice,
  isNewListing,
  wasEdited,
} from '@/lib/listing-format'

/**
 * Exactly one badge per card. Ranked most-informative first: "Free" changes
 * whether you can afford it, "Verified" is the product's core trust claim, and
 * "New" is the weakest signal. Stacking all three turns the corner into noise
 * and dilutes the one that matters.
 */
function CardBadge({ listing }: { listing: ListingSummary }) {
  if (listing.price === null) {
    return (
      <span className={cx(badge.base, badge.free)}>Free</span>
    )
  }
  if (listing.seller_verified) {
    return (
      <span className={cx(badge.base, badge.verified)}>
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
        Verified
      </span>
    )
  }
  if (isNewListing(listing.created_at)) {
    return (
      <span className={cx(badge.base, badge.new)}>New</span>
    )
  }
  return null
}

export default function ListingCard({ listing }: { listing: ListingSummary }) {
  const isEdited = wasEdited(listing.created_at, listing.updated_at)

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-brand-gray-200 bg-brand-white transition duration-300 hover:-translate-y-1 hover:border-brand-blue hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-brand-gray-100">
        {listing.thumbnail ? (
          <Image
            src={listing.thumbnail}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-brand-gray-400">
            No photo
          </div>
        )}
        <CardBadge listing={listing} />
      </div>

      <div className="flex flex-1 flex-col p-4">
        {/* Timestamp deliberately omitted from the card — freshness is still
            carried by the "New" badge on recent listings, and the full posted
            date is on the detail page. */}
        <p
          className={`font-display text-[22px] font-bold leading-tight tracking-tight ${
            listing.price === null ? 'text-brand-emerald' : 'text-brand-dark-brown'
          }`}
        >
          {formatPrice(listing.price)}
        </p>

        <h3 className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-brand-gray-600">
          {listing.title}
        </h3>

        {/* Attribute chips. These WRAP rather than scroll horizontally: a
            nested horizontal scroll region inside a card that is itself a
            link fights the tap target on touch, and anything scrolled out of
            view inside a card is effectively invisible — nobody swipes inside
            a listing card. With two or three short chips they fit on one line
            at every card width we render. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className={chip}>{CATEGORY_LABELS[listing.category] ?? listing.category}</span>
          {listing.condition && (
            <span className={chip}>{CONDITION_LABELS[listing.condition] ?? listing.condition}</span>
          )}
          {isEdited && (
            <span className={cx(chip, 'text-brand-gray-500')}>Edited</span>
          )}
        </div>

        {listing.pickup_hint && (
          <p className="mt-2 flex min-w-0 items-center gap-1 text-[13px] text-brand-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-gray-400" aria-hidden />
            <span className="truncate">{listing.pickup_hint}</span>
          </p>
        )}

        {/* The seller's own school, which can differ from the feed this listing
            appears in — a DePauw student may sell into Northeastern's feed. */}
        {listing.seller_school_name && (
          <p className="mt-auto truncate pt-2 text-xs text-brand-gray-400">
            {listing.seller_name} · {listing.seller_school_name}
          </p>
        )}
      </div>
    </Link>
  )
}
