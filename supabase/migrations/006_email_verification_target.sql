-- A verification token can now target either the account's original signup
-- email or a later-added school email (see "Add school email" flow) — store
-- which email each token is actually for, rather than assuming it's always
-- the account's primary auth email.
ALTER TABLE email_verifications ADD COLUMN email text NOT NULL DEFAULT '';
ALTER TABLE email_verifications ALTER COLUMN email DROP DEFAULT;
