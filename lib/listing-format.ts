// Shared display formatting for listings. Lives here rather than in a
// component so the browse card and the detail page can't drift into showing
// the same value two different ways.

export const CATEGORY_LABELS: Record<string, string> = {
  electronics: 'Electronics',
  furniture: 'Furniture',
  clothing: 'Clothing',
  textbooks: 'Textbooks',
  appliances: 'Appliances',
  bikes: 'Bikes',
  free: 'Free',
  other: 'Other',
}

export const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  like_new: 'Like New',
  used: 'Used',
  for_parts: 'For Parts',
}

// NULL price means free (the schema forbids 0) — see lib/validations.ts.
export function formatPrice(price: number | null): string {
  return price === null ? 'Free' : `$${price.toFixed(2).replace(/\.00$/, '')}`
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatMonthYear(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const EDIT_GRACE_MS = 60 * 60 * 1000

// "Edited" only after an hour, so fixing a typo right after posting doesn't
// brand the listing as edited (CLAUDE.md).
export function wasEdited(createdAt: string, updatedAt: string): boolean {
  return new Date(updatedAt).getTime() > new Date(createdAt).getTime() + EDIT_GRACE_MS
}

/**
 * "2h ago" / "4d ago" — marketplace listings live or die on freshness, and an
 * absolute date ("Aug 19") makes a two-hour-old post look as stale as a
 * two-week-old one.
 */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`

  return formatShortDate(iso)
}

const NEW_LISTING_HOURS = 24

export function isNewListing(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < NEW_LISTING_HOURS * 60 * 60 * 1000
}
