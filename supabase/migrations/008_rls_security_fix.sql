-- SECURITY FIX — two distinct problems, both live in production when written.
--
-- 1. Seven tables were created without ENABLE ROW LEVEL SECURITY (migrations
--    001, 002, 004). With RLS off, Supabase's default grants let ANY holder of
--    the public anon key — which ships in the site's JS bundle — read AND write
--    them. Verified live: an anonymous INSERT into schools_directory returned
--    201 and an anonymous DELETE returned 204. One unauthenticated request
--    could have wiped all 2,510 schools and broken sign-up and the waitlist.
--
-- 2. users.contact_email was world-readable. RLS filters ROWS, not COLUMNS, so
--    the (otherwise correct) "public read user profiles" policy exposed every
--    column of every visible user — including real student email addresses,
--    harvestable in a single unauthenticated request.

-- --- Part 1: reference tables — public reads, no public writes ---
-- The school pickers (SchoolCombobox, ActiveSchoolSelect) query these straight
-- from the browser with the anon key, so SELECT must stay open. Writes only
-- ever happen server-side via the service role (getOrCreateSchool in the
-- sign-up route), which bypasses RLS — so no write policy is needed or wanted.
ALTER TABLE schools_directory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read school directory"
  ON schools_directory FOR SELECT USING (true);

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read schools"
  ON schools FOR SELECT USING (true);

-- --- Part 2: v2/v3 tables — service role only ---
-- All currently empty. RLS enabled with NO policies means no anon/authenticated
-- access at all, the same deliberate pattern as email_verifications and
-- negotiation_preferences. Real policies get written when each feature is
-- actually built (chat, blocking, matching) — these must NOT be left open until
-- then, or private DMs would be world-readable the day chat ships.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_matches ENABLE ROW LEVEL SECURITY;

-- --- Part 3: hide the seller's contact email ---
-- RLS has no column-level control, so use Postgres column privileges instead.
-- Server-side code uses the service_role key, which keeps its grant and is
-- unaffected — the contact-seller flow relays mail via Resend server-side and
-- never needs the browser to see this value.
--
-- NOTE: email_verified_at is deliberately NOT revoked. EmailVerificationBanner
-- reads it through the anon-key client, and it's a low-sensitivity timestamp;
-- revoking it would break the banner for no real privacy gain.
-- When account settings (item 2.6) needs to show a user their OWN contact_email,
-- serve it from a server route using the service role rather than re-granting.
REVOKE SELECT (contact_email) ON users FROM anon, authenticated;
