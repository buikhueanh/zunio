-- Relevance-ranked search for the browse page (BUILDORDER 1.6).
--
-- PostgREST can filter with plainto_tsquery via .textSearch(), but it cannot
-- ORDER BY a computed ts_rank() value — ranking depends on the query text
-- itself, not a stored column. An RPC is the standard way to expose this.
--
-- SECURITY INVOKER (the default) so the function runs as the calling role
-- (anon/authenticated), meaning the existing "public read active supply
-- listings" RLS policy on listings still applies — this function cannot see
-- anything a direct SELECT couldn't already see.
CREATE OR REPLACE FUNCTION search_listings(
  p_school_id uuid,
  p_query     text,
  p_category  text DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_free_only boolean DEFAULT false,
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  id            uuid,
  title         text,
  price         numeric,
  thumbnail     text,
  category      text,
  condition     text,
  created_at    timestamptz,
  updated_at    timestamptz,
  seller_name   text,
  seller_slug   text,
  rank          real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.id, l.title, l.price, l.images[1] AS thumbnail, l.category, l.condition,
    l.created_at, l.updated_at,
    u.display_name AS seller_name, u.slug AS seller_slug,
    ts_rank(l.search_vector, plainto_tsquery('english', p_query)) AS rank
  FROM listings l
  JOIN users u ON l.user_id = u.id
  WHERE u.school_id      = p_school_id
    AND l.status         = 'active'
    AND l.listing_type   = 'supply'
    AND l.deleted_at     IS NULL
    AND l.search_vector  @@ plainto_tsquery('english', p_query)
    AND (p_category  IS NULL OR l.category = p_category)
    AND (p_condition IS NULL OR l.condition = p_condition)
    AND (NOT p_free_only OR l.price IS NULL)
    AND (p_max_price IS NULL OR p_free_only OR l.price <= p_max_price)
  ORDER BY rank DESC, l.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION search_listings TO anon, authenticated;
