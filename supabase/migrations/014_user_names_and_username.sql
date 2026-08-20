-- Replace the single `display_name` + generated `slug` with structured
-- first/last names and a user-chosen `username` (see DECISIONS.md 2026-08-19).
--
-- Three problems this fixes:
--   1. display_name was not unique and slug carried a random hex suffix, so
--      students had no reliable way to find each other.
--   2. generateSlug() strips every non-ASCII character, so a name written in
--      a non-Latin script produced a slug like "-7f2a".
--   3. Two identifiers (slug + a future username) for one person can drift.
--      username IS the profile URL now; slug is removed outright.

ALTER TABLE users ADD COLUMN first_name text;
ALTER TABLE users ADD COLUMN last_name  text;
ALTER TABLE users ADD COLUMN username   text;

-- Backfill from existing data before the NOT NULL constraints land.
-- display_name held "First Last"; split on the FIRST space so multi-word
-- surnames ("Van Der Berg") stay intact in last_name.
UPDATE users
SET first_name = COALESCE(NULLIF(split_part(display_name, ' ', 1), ''), display_name),
    last_name  = NULLIF(substring(display_name from position(' ' in display_name) + 1), display_name),
    -- Derive a username from the existing slug by dropping its random suffix
    -- and separators: "anh-bui-9375" -> "anhbui".
    username   = regexp_replace(regexp_replace(slug, '-[0-9a-f]{4}$', ''), '[^a-z0-9]', '', 'g')
WHERE first_name IS NULL;

-- Any row whose derived username came out too short falls back to the full
-- slug with separators stripped, so the NOT NULL below can never fail.
UPDATE users
SET username = regexp_replace(slug, '[^a-z0-9]', '', 'g')
WHERE char_length(COALESCE(username, '')) < 3;

ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN username   SET NOT NULL;

-- last_name stays nullable on purpose: mononyms are common among Indonesian
-- and some South Indian students, and forcing a value would make them enter
-- fake data — corrupting the real-identity signal the whole product rests on.
ALTER TABLE users ADD CONSTRAINT users_first_name_length
  CHECK (char_length(first_name) BETWEEN 1 AND 40);
ALTER TABLE users ADD CONSTRAINT users_last_name_length
  CHECK (last_name IS NULL OR char_length(last_name) BETWEEN 1 AND 40);

-- Usernames are stored canonically lowercase: ONE representation, so there is
-- nothing to keep in sync. The format rule also forbids a leading/trailing
-- separator and requires 3-30 chars.
ALTER TABLE users ADD CONSTRAINT users_username_format
  CHECK (username ~ '^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$');

-- Case-insensitive uniqueness enforced by the DATABASE, not application code.
-- An app-level "is it taken?" check loses to two concurrent sign-ups: both
-- read, both see it free, both insert. Lowercase storage plus this index makes
-- that race impossible. (Index is on lower() as belt-and-braces in case a row
-- ever lands with mixed case through some future path.)
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

-- display_name becomes GENERATED so it can never disagree with the name parts.
-- It is kept because listing cards, search results and the RPC all read a
-- single display string; deriving it in the database means a future account
-- settings page physically cannot leave it stale.
ALTER TABLE users DROP COLUMN display_name;
ALTER TABLE users ADD COLUMN display_name text
  GENERATED ALWAYS AS (
    CASE WHEN last_name IS NULL OR last_name = ''
      THEN first_name
      ELSE first_name || ' ' || last_name
    END
  ) STORED;

-- slug is fully replaced by username.
ALTER TABLE users DROP COLUMN slug;

-- Dropping/re-adding columns drops their column-level grants, so re-issue the
-- safe-column allowlist from migration 009. contact_email stays revoked —
-- listing the safe columns explicitly keeps new columns private by default.
REVOKE SELECT ON users FROM anon, authenticated;
GRANT SELECT (
  id,
  first_name,
  last_name,
  username,
  display_name,
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
