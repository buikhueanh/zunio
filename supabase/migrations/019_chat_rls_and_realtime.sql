-- Activate the chat tables: structure, RLS policies, and Realtime.
--
-- conversations / conversation_participants / messages were created in 004 and
-- locked down in 008 with RLS enabled and NO policies (service-role only).
-- 008's comment called this out explicitly: they "must NOT be left open until
-- then, or private DMs would be world-readable the day chat ships". This is
-- that day, so the policies below are the security-critical part of the feature.
--
-- Realtime makes them doubly critical: Postgres Changes evaluates the SELECT
-- policy per subscriber, so a policy that is too loose does not merely expose
-- rows to a query — it actively pushes other people's private messages to a
-- subscriber's browser as they are written.

-- --- Structure ---

-- A conversation is (listing, buyer); the seller is listings.user_id. Storing
-- buyer_id lets a UNIQUE constraint prevent duplicate threads — two fast clicks
-- on "Message seller" would otherwise create two conversations, splitting the
-- history in half with no way to merge it.
ALTER TABLE conversations ADD COLUMN buyer_id uuid REFERENCES users(id);
ALTER TABLE conversations ADD CONSTRAINT conversations_listing_buyer_key
  UNIQUE (listing_id, buyer_id);

-- Denormalized for inbox ordering ("most recent conversation first"). Kept
-- correct by a trigger rather than by application code, so it cannot drift.
ALTER TABLE conversations ADD COLUMN last_message_at timestamptz DEFAULT now();

CREATE INDEX conversations_buyer_idx ON conversations (buyer_id);
CREATE INDEX conversations_last_message_idx ON conversations (last_message_at DESC);

CREATE OR REPLACE FUNCTION touch_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
     SET last_message_at = NEW.created_at
   WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_touch_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION touch_conversation_last_message();

-- --- Participation check ---

-- SECURITY DEFINER is REQUIRED here, not a shortcut. The natural policy on
-- conversation_participants ("you may read rows of conversations you belong
-- to") has to consult conversation_participants, which re-triggers the same
-- policy — Postgres raises infinite recursion (42P17). Running the lookup as
-- the definer bypasses RLS for this one query and breaks the cycle.
--
-- search_path is pinned so the function body cannot be redirected to a
-- malicious same-named table via a caller-controlled search_path.
CREATE OR REPLACE FUNCTION is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM conversation_participants cp
     WHERE cp.conversation_id = p_conversation_id
       AND cp.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION is_conversation_participant(uuid) FROM public;
GRANT EXECUTE ON FUNCTION is_conversation_participant(uuid) TO anon, authenticated;

-- --- Policies ---
-- Reads only. Creating a conversation inserts a participant row for the OTHER
-- person too, which no correct user-scoped INSERT policy could permit, and
-- sending a message must pass rate limiting first — so both are done
-- server-side with the service role. Deliberately no INSERT/UPDATE policy on
-- conversations or messages: least privilege, and the client cannot bypass the
-- rate limiter by writing to the table directly.

CREATE POLICY "participants read their conversations"
  ON conversations FOR SELECT
  USING (is_conversation_participant(id));

CREATE POLICY "participants read participant rows"
  ON conversation_participants FOR SELECT
  USING (is_conversation_participant(conversation_id));

-- Marking a thread read is the one thing the client may write directly, and
-- only on its own row.
CREATE POLICY "own participant row update"
  ON conversation_participants FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "participants read messages"
  ON messages FOR SELECT
  USING (is_conversation_participant(conversation_id) AND deleted_at IS NULL);

-- --- Realtime ---
-- Subscribers receive INSERTs on messages, filtered per-subscriber by the
-- SELECT policy above.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
