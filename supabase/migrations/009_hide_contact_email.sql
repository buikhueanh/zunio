-- Fixes migration 008's Part 3, which did not work.
--
-- 008 used: REVOKE SELECT (contact_email) ON users FROM anon, authenticated;
-- That is a NO-OP in Postgres when the role already holds table-level SELECT —
-- a table-wide grant implies every column, and a column-level revoke cannot
-- carve an exception out of it. Supabase grants anon/authenticated table-level
-- SELECT by default, so contact_email stayed world-readable (verified live:
-- an anonymous request still returned it after 008 was applied).
--
-- The working pattern is the inverse: drop the table-wide grant, then grant
-- back only the columns that are safe to expose.

REVOKE SELECT ON users FROM anon, authenticated;

-- Every column EXCEPT contact_email. Notably kept public:
--   is_seller_verified — wanted for a "verified student" badge on listings
--   email_verified_at  — read by EmailVerificationBanner via the anon-key
--                        client; low-sensitivity timestamp
--   is_suspended / deleted_at — always false/null for rows the RLS policy
--                        makes visible, so they reveal nothing
GRANT SELECT (
  id,
  display_name,
  slug,
  school_id,
  is_seller_verified,
  bio,
  social_url,
  profile_photo,
  is_suspended,
  deleted_at,
  created_at,
  updated_at,
  email_verified_at
) ON users TO anon, authenticated;

-- Server-side code uses the service_role key, which is unaffected and still
-- reads contact_email — that's all the contact-seller relay needs. When account
-- settings (item 2.6) shows a user their OWN contact_email, serve it from a
-- server route using the service role rather than re-granting it here.
