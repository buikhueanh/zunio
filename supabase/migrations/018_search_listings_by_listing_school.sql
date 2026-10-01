-- Scope search on the LISTING's campus rather than the seller's.
-- Mirrors migration 017: where an item is sold is now a property of the
-- listing, not of whoever posted it.
--
-- seller_school_name is added so results can show the seller's real school
-- (their verified identity), which may legitimately differ from the feed the
-- listing appears in — a Harvard student selling into the Northeastern feed
-- should read "Harvard University", not "Northeastern".
-- Adding seller_school_name changes the OUT row type, which CREATE OR REPLACE
-- cannot do (42P13) — the function has to be dropped and recreated.
DROP FUNCTION IF EXISTS search_listings(uuid, text, text, numeric, text, boolean, int);

CREATE FUNCTION search_listings(
  p_school_id uuid,
  p_query     text,
  p_category  text DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_condition text DEFAULT NULL,
  p_free_only boolean DEFAULT false,
  p_limit     int DEFAULT 20
)
RETURNS TABLE (
  id                 uuid,
  title              text,
  price              numeric,
  thumbnail          text,
  category           text,
  condition          text,
  created_at         timestamptz,
  updated_at         timestamptz,
  seller_name        text,
  seller_slug        text,
  seller_school_name text,
  rank               real
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    l.id, l.title, l.price, l.images[1] AS thumbnail, l.category, l.condition,
    l.created_at, l.updated_at,
    u.display_name AS seller_name, u.username AS seller_slug,
    seller_dir.name AS seller_school_name,
    ts_rank(l.search_vector, plainto_tsquery('english', p_query)) AS rank
  FROM listings l
  JOIN users u ON l.user_id = u.id
  LEFT JOIN schools seller_school ON u.school_id = seller_school.id
  LEFT JOIN schools_directory seller_dir ON seller_school.directory_id = seller_dir.id
  WHERE l.school_id      = p_school_id
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
