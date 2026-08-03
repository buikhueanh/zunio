import { randomBytes } from 'crypto'

// Long enough to be unguessable for a single-use, unauthenticated link.
export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex')
}
