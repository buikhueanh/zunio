/**
 * Decides whether a verified email address belongs to a given school's domain.
 *
 * This is the gate for `is_seller_verified` — the "verified student" claim the
 * whole product's trust model rests on — so it is deliberately isolated here
 * rather than inlined in a route, and errs toward rejecting.
 *
 * The rule: an exact domain match, or a strict SUBDOMAIN of the school domain.
 * Universities routinely host student mail on a subdomain (University of
 * Cincinnati's directory domain is `uc.edu`, but students receive mail at
 * `mail.uc.edu`), which an exact-equality check silently rejects.
 *
 * The dot boundary is the load-bearing part. A plain `endsWith(schoolDomain)`
 * would be a real vulnerability, not a theoretical one: `uc.edu`, `buc.edu`,
 * `puc.edu`, `luc.edu` and `huc.edu` are ALL separate institutions in
 * schools_directory, and "buc.edu".endsWith("uc.edu") is true. Requiring
 * ".uc.edu" makes a sibling institution's domain fail, as it must.
 */

function stripTrailingDot(host: string): string {
  return host.endsWith('.') ? host.slice(0, -1) : host
}

/**
 * Canonicalizes a domain from the schools_directory column. Tolerates the
 * shapes an imported dataset can carry (protocol, www., a trailing path) even
 * though the current IPEDS import happens to be clean — the import is
 * re-runnable and a future dataset may not be.
 */
export function normalizeSchoolDomain(raw: string | null | undefined): string {
  if (!raw) return ''
  return stripTrailingDot(
    raw
      .trim()
      .toLowerCase()
      .replace(/^[a-z]+:\/\//, '')
      .replace(/^www\./, '')
      .replace(/[/?#].*$/, '')
  )
}

/**
 * Pulls the domain from an email address. Deliberately does NOT strip "www."
 * or other prefixes — unlike the school domain, anything unusual on this side
 * should cause a mismatch rather than be normalized into one. lastIndexOf
 * handles local parts that themselves contain '@'.
 */
export function extractEmailDomain(email: string | null | undefined): string {
  if (!email) return ''
  const at = email.lastIndexOf('@')
  if (at === -1) return ''
  return stripTrailingDot(email.slice(at + 1).trim().toLowerCase())
}

function matchesOneDomain(emailDomain: string, rawSchoolDomain: string | null | undefined): boolean {
  const school = normalizeSchoolDomain(rawSchoolDomain)
  if (!school || !emailDomain) return false

  // A single-label school domain (e.g. "edu") would match every institution in
  // the country. Nothing in the current dataset looks like this, but a bad
  // import must not silently turn into blanket verification.
  if (school.split('.').filter(Boolean).length < 2) return false
  if (emailDomain.split('.').filter(Boolean).length < 2) return false

  if (emailDomain === school) return true

  // Strict subdomain only — see the dot-boundary note above.
  return emailDomain.endsWith(`.${school}`)
}

/**
 * @param schoolDomain   the school's website domain from schools_directory
 * @param extraDomains   schools.email_domains — additional accepted mail
 *                       domains for schools whose student mail lives somewhere
 *                       unrelated to their website domain. Additive: the
 *                       directory domain keeps working regardless, so an empty
 *                       list is the correct default and never locks anyone out.
 */
export function matchesSchoolDomain(
  email: string | null | undefined,
  schoolDomain: string | null | undefined,
  extraDomains?: readonly string[] | null
): boolean {
  const emailDomain = extractEmailDomain(email)
  if (!emailDomain) return false

  if (matchesOneDomain(emailDomain, schoolDomain)) return true
  return (extraDomains ?? []).some((extra) => matchesOneDomain(emailDomain, extra))
}
