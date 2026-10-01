import type { ListingSummary } from '@/lib/listings'
import ListingCard from './ListingCard'

interface ListingGridProps {
  listings: ListingSummary[]
  schoolLabel: string
  searchQuery?: string
  isFirstPage: boolean
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

export default function ListingGrid({
  listings,
  schoolLabel,
  searchQuery,
  isFirstPage,
  hasMore,
  loadingMore,
  onLoadMore,
}: ListingGridProps) {
  if (isFirstPage && listings.length === 0) {
    if (searchQuery) {
      return (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <p className="text-sm text-brand-gray-500">
            No listings for &ldquo;{searchQuery}&rdquo; at {schoolLabel}.
          </p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-base font-semibold text-brand-dark-brown">
          Be the first to sell here
        </p>
        <p className="text-sm text-brand-gray-500">
          No listings at {schoolLabel} yet.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Two per row on phones so cards stay legible at ~170px, four from
          tablet up. Capped at four rather than five — beyond that the images
          get small enough that browsing turns into squinting. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="mx-auto rounded-md border border-brand-gray-200 px-6 py-3 text-sm font-semibold text-brand-dark-brown transition hover:border-brand-emerald hover:text-brand-emerald disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
