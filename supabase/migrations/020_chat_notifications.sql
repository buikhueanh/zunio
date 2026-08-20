-- Tracks when each participant was last emailed about a conversation, so an
-- active back-and-forth doesn't generate one email per message.
--
-- Without this, two students chatting in real time would each receive a dozen
-- "you have a new message" emails in five minutes — which trains people to
-- ignore the notification that matters, and burns the shared Resend quota that
-- sign-up verification also depends on.
ALTER TABLE conversation_participants ADD COLUMN last_notified_at timestamptz;

COMMENT ON COLUMN conversation_participants.last_notified_at IS
  'When this participant was last emailed about new messages here. Used to '
  'throttle notifications during an active conversation. Server-managed: the '
  'column grant below keeps clients from writing it.';

-- RLS filters ROWS, not COLUMNS — the "own participant row update" policy from
-- migration 019 would otherwise let a client write every column on its own row,
-- including last_notified_at (letting someone silence their own notifications
-- and desync the throttle). Same inverse-grant pattern as migration 009:
-- drop the table-wide UPDATE, then grant back only the column clients may set.
REVOKE UPDATE ON conversation_participants FROM anon, authenticated;
GRANT UPDATE (last_read_at) ON conversation_participants TO authenticated;
