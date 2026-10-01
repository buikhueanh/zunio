-- Migration 014 dropped users.slug in favour of users.username, which this
-- function still referenced. Re-created with the same shape so callers only
-- see the column rename (seller_slug now carries the username).
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
    u.display_name AS seller_name, u.username AS seller_slug,
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
    AND (
      p_max_price IS NULL
      OR p_free_only
      OR l.price <= p_max_price
      OR l.price IS NULL   -- free counts as under any ceiling
    )
  ORDER BY rank DESC, l.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION search_listings TO anon, authenticated;
