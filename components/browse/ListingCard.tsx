import Link from 'next/link'
import Image from 'next/image'
import type { ListingSummary } from '@/lib/listings'

const CATEGORY_LABELS: Record<string, string> = {
  electronics: 'Electronics',
  furniture: 'Furniture',
  clothing: 'Clothing',
  textbooks: 'Textbooks',
  appliances: 'Appliances',
  bikes: 'Bikes',
  free: 'Free',
  other: 'Other',
}

const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  used: 'Used',
  for_parts: 'For Parts',
}

function formatPrice(price: number | null): string {
  return price === null ? 'Free' : `$${price.toFixed(2).replace(/\.00$/, '')}`
}

function formatPostedDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ListingCard({ listing }: { listing: ListingSummary }) {
  const isEdited = new Date(listing.updated_at).getTime() > new Date(listing.created_at).getTime() + 3600_000

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-brand-gray-200 bg-brand-white transition hover:border-brand-emerald hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-brand-gray-100">
        {listing.thumbnail ? (
          <Image
            src={listing.thumbnail}
            alt={listing.title}
            fill
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-brand-gray-400">
            No photo
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold text-brand-dark-brown">
            {listing.title}
          </h3>
          {isEdited && (
            <span className="shrink-0 rounded-full bg-brand-gray-100 px-2 py-0.5 text-[10px] font-medium text-brand-gray-500">
              Edited
            </span>
          )}
        </div>
        <p className="font-display text-base font-bold text-brand-emerald">
          {formatPrice(listing.price)}
        </p>
        <div className="mt-1 flex flex-wrap gap-1 text-xs text-brand-gray-500">
          <span>{CATEGORY_LABELS[listing.category] ?? listing.category}</span>
          {listing.condition && (
            <>
              <span>·</span>
              <span>{CONDITION_LABELS[listing.condition] ?? listing.condition}</span>
            </>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-brand-gray-400">
          <span className="truncate">{listing.seller_name}</span>
          <span className="shrink-0">{formatPostedDate(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
