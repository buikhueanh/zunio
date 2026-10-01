-- Give each listing its own campus, instead of inheriting the seller's.
--
-- Two problems this fixes:
--   1. A student near another campus could not sell there. Boston has Harvard,
--      Northeastern, BU, MIT and Tufts within a few miles — a Harvard student
--      living by Northeastern was verified fine, but their listing landed in
--      Harvard's (unlaunched) feed where nobody would ever see it.
--   2. Feed membership was derived from users.school_id, so changing your
--      school in account settings silently dragged every listing you had ever
--      posted to the new campus. CLAUDE.md documents the opposite
--      ("Existing listings remain"), which was impossible to deliver.
--
-- school_id here is WHERE THE ITEM IS SOLD. It is deliberately independent of
-- the seller's own school, which remains their verified identity and is what
-- gets displayed on the listing.
ALTER TABLE listings ADD COLUMN school_id uuid REFERENCES schools(id);

-- Backfill: existing listings keep the behaviour they had, i.e. the seller's
-- school. (Zero rows at time of writing, but this must be correct if re-run.)
UPDATE listings l
SET school_id = u.school_id
FROM users u
WHERE l.user_id = u.id AND l.school_id IS NULL;

ALTER TABLE listings ALTER COLUMN school_id SET NOT NULL;

-- Browse is "active supply listings at one school, newest first" — this index
-- matches that access path directly. The old index on (status, created_at)
-- could not narrow by school first.
CREATE INDEX listings_school_active_created_idx
  ON listings (school_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN listings.school_id IS
  'The campus feed this listing appears in. Chosen at creation and independent '
  'of the seller''s own school (users.school_id), which stays their verified '
  'identity. Must reference an active school — enforced in the API route.';
