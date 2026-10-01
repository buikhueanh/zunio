-- Owners can read their own listings regardless of status.
--
-- The existing policy is:
--   "public read active supply listings"
--   USING (status = 'active' AND deleted_at IS NULL AND listing_type = 'supply')
--
-- That is correct for the public, but it also applies to the owner, so a
-- seller cannot read their own listing once it stops being active. The moment
-- "mark as sold" ships (2.4), the seller would mark an item sold and instantly
-- get a 404 on their own listing page; the account page (2.6) likewise could
-- not show sold listings. Both would look like data loss to the user.
--
-- Scoped to auth.uid() = user_id, so this widens visibility for the owner only.
-- deleted_at IS NULL is kept: soft-deleted rows are moderation removals and
-- stay invisible to everyone through the client, owner included.
CREATE POLICY "owners read own listings"
  ON listings FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);
