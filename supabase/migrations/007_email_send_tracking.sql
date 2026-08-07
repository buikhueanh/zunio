-- Track whether a confirmation/verification email actually sent successfully.
-- NULL means "not successfully sent" — either it failed, or it predates this
-- tracking. Lets us find silent failures and retry them later.
--
-- Context: Resend's SDK returns API errors as a *return value*, not a thrown
-- exception, so the original `try { send() } catch {}` never fired and failed
-- sends were indistinguishable from successful ones. See docs/CHANGELOG.md.
ALTER TABLE waitlist ADD COLUMN confirmation_sent_at timestamptz;
ALTER TABLE email_verifications ADD COLUMN sent_at timestamptz;
