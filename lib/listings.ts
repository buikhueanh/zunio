import type { SupabaseClient } from '@supabase/supabase-js'

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
  created_at: string
  updated_at: string
  users: { display_name: string; slug: string } | null
}

function mapRow(row: ListingRow): ListingSummary {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    thumbnail: row.images?.[0] ?? null,
    category: row.category,
    condition: row.condition,
    created_at: row.created_at,
    updated_at: row.updated_at,
    seller_name: row.users?.display_name ?? 'A student',
    seller_slug: row.users?.slug ?? '',
  }
}

// Search goes through the search_listings RPC (needs ts_rank ordering, which
// plain PostgREST filters can't express) and is capped to one page — MVP
// scope, see DECISIONS.md. Browse (no query) uses cursor-based pagination.
export async function fetchListings(
  supabase: SupabaseClient,
  filters: BrowseFilters
): Promise<{ listings: ListingSummary[]; nextCursor: string | null }> {
  if (filters.query && filters.query.trim().length > 0) {
    const { data, error } = await supabase.rpc('search_listings', {
      p_school_id: filters.schoolId,
      p_query: filters.query.trim(),
      p_category: filters.category ?? null,
      p_max_price: filters.freeOnly ? null : filters.maxPrice ?? null,
      p_condition: filters.condition ?? null,
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
      }) => ({
        id: row.id,
        title: row.title,
        price: row.price,
        thumbnail: row.thumbnail,
        category: row.category,
        condition: row.condition,
        created_at: row.created_at,
        updated_at: row.updated_at,
        seller_name: row.seller_name ?? 'A student',
        seller_slug: row.seller_slug ?? '',
      })
    )
    return { listings, nextCursor: null }
  }

  let q = supabase
    .from('listings')
    .select(
      'id, title, price, images, category, condition, created_at, updated_at, users!inner(display_name, slug, school_id)'
    )
    .eq('users.school_id', filters.schoolId)
    .eq('status', 'active')
    .eq('listing_type', 'supply')
    .is('deleted_at', null)

  if (filters.category) q = q.eq('category', filters.category)
  if (filters.condition) q = q.eq('condition', filters.condition)
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
