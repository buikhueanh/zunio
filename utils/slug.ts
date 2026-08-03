import { randomBytes } from 'crypto'

// "Alex Kim" -> "alex-kim-7f2a". See DECISIONS.md: generated slug for profile
// URLs, not user-chosen — avoids a username reservation system.
export function generateSlug(displayName: string): string {
  const base = displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const suffix = randomBytes(2).toString('hex')
  return `${base}-${suffix}`
}
