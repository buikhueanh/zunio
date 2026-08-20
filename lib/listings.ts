import type { SupabaseClient } from '@supabase/supabase-js'
import { listingImageUrl } from '@/lib/images'

export const CATEGORIES = [
  'electronics',
  'furniture',
  'clothing',
  'textbooks',
  'appliances',
  'bikes',
  'free',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const CONDITIONS = ['new', 'like_new', 'used', 'for_parts'] as const
export type Condition = (typeof CONDITIONS)[number]

export type SortOption = 'newest' | 'price_asc' | 'price_desc'

export type ListingSummary = {
  id: string
  title: string
  price: number | null
  thumbnail: string | null
  category: string
  condition: string | null
  created_at: string
  updated_at: string
  seller_name: string
  seller_slug: string
  // The seller's OWN school (verified identity), which can differ from the
  // feed the listing appears in.
  seller_school_name: string | null
  pickup_hint: string | null
  seller_verified: boolean
}

export type BrowseFilters = {
  schoolId: string
  category?: Category
  maxPrice?: number
  freeOnly?: boolean
  condition?: Condition
  sort?: SortOption
  query?: string
  cursor?: string | null
}

const PAGE_SIZE = 20

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
  users: {
    display_name: string
    username: string
    is_seller_verified: boolean
    schools: { schools_directory: { name: string } | null } | null
  } | null
}

function mapRow(row: ListingRow): ListingSummary {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    // images stores Storage object paths, not URLs — resolve for rendering.
    thumbnail: row.images?.[0] ? listingImageUrl(row.images[0]) : null,
    category: row.category,
    condition: row.condition,
    created_at: row.created_at,
    updated_at: row.updated_at,
    seller_name: row.users?.display_name ?? 'A student',
    seller_slug: row.users?.username ?? '',
    seller_school_name: row.users?.schools?.schools_directory?.name ?? null,
    pickup_hint: row.pickup_hint,
    seller_verified: Boolean(row.users?.is_seller_verified),
  }
}

// Search goes through the search_listings RPC (needs ts_rank ordering, which
// plain PostgREST filters can't express) and is capped to one page — MVP
// scope, see DECISIONS.md. Browse (no query) uses cursor-based pagination.
export async function fetchListings(
  supabase: SupabaseClient,
  filters: BrowseFilters
): Promise<{ listings: ListingSummary[]; nextCursor: string | null }> {
  // Category/condition are compared against lowercase DB values, so canonicalize
  // here too — otherwise a caller passing "Free" silently matches zero rows
  // rather than erroring, which is the worst kind of wrong.
  const category = filters.category?.trim().toLowerCase() as Category | undefined
  const condition = filters.condition?.trim().toLowerCase() as Condition | undefined

  if (filters.query && filters.query.trim().length > 0) {
    const { data, error } = await supabase.rpc('search_listings', {
      p_school_id: filters.schoolId,
      p_query: filters.query.trim(),
      p_category: category ?? null,
      p_max_price: filters.freeOnly ? null : filters.maxPrice ?? null,
      p_condition: condition ?? null,
      p_free_only: filters.freeOnly ?? false,
      p_limit: PAGE_SIZE,
    })

    if (error) {
      console.error('search_listings failed', error)
      return { listings: [], nextCursor: null }
    }

    const listings: ListingSummary[] = (data ?? []).map(
      (row: {
        id: string
        title: string
        price: number | null
        thumbnail: string | null
        category: string
        condition: string | null
        created_at: string
        updated_at: string
        seller_name: string
        seller_slug: string
        seller_school_name: string | null
      }) => ({
        id: row.id,
        title: row.title,
        price: row.price,
        thumbnail: row.thumbnail ? listingImageUrl(row.thumbnail) : null,
        category: row.category,
        condition: row.condition,
        created_at: row.created_at,
        updated_at: row.updated_at,
        seller_name: row.seller_name ?? 'A student',
        seller_slug: row.seller_slug ?? '',
        seller_school_name: row.seller_school_name ?? null,
        // The search RPC doesn't project these; cards fall back gracefully.
        pickup_hint: null,
        seller_verified: false,
      })
    )
    return { listings, nextCursor: null }
  }

  let q = supabase
    .from('listings')
    .select(
      'id, title, price, images, category, condition, pickup_hint, created_at, updated_at, ' +
        'users!inner(display_name, username, is_seller_verified, schools(schools_directory(name)))'
    )
    // Scoped on the LISTING's campus, not the seller's — a student may sell
    // into a nearby school's feed (migration 017).
    .eq('school_id', filters.schoolId)
    .eq('status', 'active')
    .eq('listing_type', 'supply')
    .is('deleted_at', null)

  if (category) q = q.eq('category', category)
  if (condition) q = q.eq('condition', condition)
  if (filters.freeOnly) {
    q = q.is('price', null)
  } else if (filters.maxPrice !== undefined) {
    // Free items count as under any ceiling — a plain .lte() would drop them,
    // since NULL <= n is NULL, not true. Mirrors migration 011's RPC change.
    q = q.or(`price.lte.${filters.maxPrice},price.is.null`)
  }

  const sort = filters.sort ?? 'newest'
  if (sort === 'price_asc') {
    q = q.order('price', { ascending: true, nullsFirst: true })
  } else if (sort === 'price_desc') {
    q = q.order('price', { ascending: false, nullsFirst: false })
  } else {
    q = q.order('created_at', { ascending: false })
  }

  if (filters.cursor && sort === 'newest') {
    q = q.lt('created_at', filters.cursor)
  }

  q = q.limit(PAGE_SIZE)

  const { data, error } = await q.returns<ListingRow[]>()

  if (error) {
    console.error('fetchListings failed', error)
    return { listings: [], nextCursor: null }
  }

  const listings = data.map(mapRow)
  // Cursor pagination only supported for the newest sort (see BrowseFilters
  // comment) — price sorts stay single-page at MVP scope.
  const nextCursor =
    sort === 'newest' && listings.length === PAGE_SIZE
      ? listings[listings.length - 1].created_at
      : null

  return { listings, nextCursor }
}
