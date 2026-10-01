-- Activate blocking.
--
-- blocked_users was created in migration 004 and locked down in 008 with RLS
-- enabled and no policies (service-role only). Enforcement so far happens only
-- when a conversation is CREATED, which means blocking someone you are already
-- talking to does nothing — the exact case that matters, since you rarely want
-- to block a stranger you have never spoken to.
--
-- Policies are scoped to the blocker. A user manages their own block list and
-- can see only their own: who has blocked YOU is deliberately not readable,
-- because exposing it both confirms the block and invites retaliation.
-- Enforcement reads happen server-side with the service role.

ALTER TABLE blocked_users
  ADD CONSTRAINT blocked_users_no_self_block CHECK (blocker_id <> blocked_id);

CREATE POLICY "users read own blocks"
  ON blocked_users FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "users create own blocks"
  ON blocked_users FOR INSERT
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "users remove own blocks"
  ON blocked_users FOR DELETE
  USING (auth.uid() = blocker_id);

-- Enforcement checks "is there a block in EITHER direction between these two
-- people", on every message send. Indexed both ways so that check stays cheap.
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON blocked_users (blocked_id);
