/**
 * Shared pre-launch preview access.
 *
 * Used by BOTH middleware (which gates routes) and the root page (which
 * chooses teaser vs. marketplace). They have to agree: when only middleware
 * knew about preview access, an invited tester could reach /sign-up but the
 * homepage still showed them the waitlist form — the app was unreachable
 * through the front door.
 *
 * PREVIEW_ACCESS_CODE is deliberately NOT prefixed NEXT_PUBLIC_. That prefix
 * inlines a value into the client bundle, which would publish the code to
 * anyone who opens devtools.
 */
export const PREVIEW_COOKIE = 'zunio_preview'
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 days

/**
 * Constant-time comparison, so the code cannot be recovered a character at a
 * time by measuring how long a rejection takes.
 */
export function matchesPreviewCode(candidate: string | undefined | null): boolean {
  const expected = process.env.PREVIEW_ACCESS_CODE
  if (!expected || !candidate) return false
  if (candidate.length !== expected.length) return false

  let diff = 0
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
