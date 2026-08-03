-- Our own email verification, decoupled from Supabase Auth's built-in
-- confirm-email gate (which we disabled — see DECISIONS.md). Sessions are
-- now issued immediately on sign-up; this tracks whether the user has since
-- clicked their verification link.
ALTER TABLE users ADD COLUMN email_verified_at timestamptz;

-- Verification tokens live in their own table, not on `users`, because
-- `users` has a public SELECT policy (profiles are publicly readable) — a
-- token column there would leak to anyone. No RLS policy here at all:
-- service role only, same pattern as negotiation_preferences.
CREATE TABLE email_verifications (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token      text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE email_verifications ENABLE ROW LEVEL SECURITY;
