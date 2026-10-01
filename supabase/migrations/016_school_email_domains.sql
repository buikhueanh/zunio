-- Extra mail domains a school accepts for seller verification.
--
-- schools_directory.domain comes from IPEDS WEBADDR — the school's WEBSITE
-- domain. Student mail domains frequently differ:
--   * subdomain of the web domain  (uc.edu -> mail.uc.edu, harvard.edu ->
--     g.harvard.edu). Already handled by the subdomain rule in
--     lib/school-email.ts, with no per-school configuration.
--   * a COMPLETELY different domain, which no rule can infer.
--
-- This column exists for that second case only. It is ADDITIVE: the normal
-- directory-domain match still applies, so leaving it NULL is correct for the
-- overwhelming majority of schools and can never lock anyone out. Filling it
-- in is a targeted fix for a school we discover has an unrelated mail domain.
--
-- Entries must be bare, lowercase hostnames ("alum.example.edu"), no protocol
-- or "@". Each entry matches exactly OR as a parent of a subdomain, the same
-- rule the directory domain uses.
ALTER TABLE schools ADD COLUMN email_domains text[];

COMMENT ON COLUMN schools.email_domains IS
  'Additional accepted mail domains for seller verification, beyond the '
  'schools_directory web domain and its subdomains. Bare lowercase hostnames. '
  'NULL/empty is normal — only set when a school uses a mail domain that is '
  'not derivable from its website domain.';
