// Usernames are the public profile identity (/u/[username]) and are stored
// canonically lowercase — one representation, so nothing can drift out of sync.
// See DECISIONS.md 2026-08-19.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

// Mirrors the users_username_format CHECK constraint in migration 014.
export const USERNAME_PATTERN = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/

/**
 * Names people must not be able to claim.
 *
 * Two distinct risks: impersonating the company ("zunio", "support" — a
 * message from @support carries authority the sender doesn't have), and
 * colliding with paths if profiles ever move to a top-level route.
 */
export const RESERVED_USERNAMES = new Set([
  'zunio',
  'athenova',
  'admin',
  'administrator',
  'support',
  'help',
  'moderation',
  'moderator',
  'mod',
  'staff',
  'team',
  'official',
  'security',
  'billing',
  'payments',
  'root',
  'system',
  'api',
  'about',
  'account',
  'accounts',
  'settings',
  'signin',
  'sign-in',
  'signup',
  'sign-up',
  'login',
  'logout',
  'listings',
  'listing',
  'browse',
  'search',
  'u',
  'me',
  'new',
  'edit',
  'report',
  'terms',
  'privacy',
  'aup',
  'legal',
  'contact',
  'null',
  'undefined',
])

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(normalizeUsername(username))
}

/**
 * Builds a starting-point username from a person's name, e.g.
 * "Anh" + "Bui" -> "anhbui". Strips anything outside the allowed charset,
 * which means a name in a non-Latin script can reduce to "" — the caller
 * must treat an empty result as "no suggestion" and let the user type one,
 * rather than generating a garbage handle (the old generateSlug produced
 * slugs like "-7f2a" for exactly this case).
 */
export function suggestUsername(firstName: string, lastName?: string | null): string {
  const base = `${firstName}${lastName ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return base.slice(0, USERNAME_MAX)
}

export function isValidUsername(username: string): boolean {
  const normalized = normalizeUsername(username)
  return (
    normalized.length >= USERNAME_MIN &&
    normalized.length <= USERNAME_MAX &&
    USERNAME_PATTERN.test(normalized) &&
    !isReservedUsername(normalized)
  )
}
