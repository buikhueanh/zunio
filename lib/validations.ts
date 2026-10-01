import { z } from 'zod'
import {
  USERNAME_MIN,
  USERNAME_MAX,
  USERNAME_PATTERN,
  isReservedUsername,
} from '@/utils/username'

export const waitlistSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    school_id: z.string().uuid().nullable().optional(),
    school_name_raw: z.string().trim().min(1).max(200).nullable().optional(),
  })
  .refine((data) => Boolean(data.school_id) || Boolean(data.school_name_raw), {
    message: 'Either school_id or school_name_raw is required',
    path: ['school_id'],
  })

export type WaitlistInput = z.infer<typeof waitlistSchema>

export const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  // Names keep the casing the person typed — they're proper nouns, and
  // display_name is generated from them in the database (migration 014).
  first_name: z.string().trim().min(1, 'First name is required').max(40),
  // Optional: mononyms are common among Indonesian and some South Indian
  // students, and forcing a value would just produce fake data.
  last_name: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  // Lowercased here so the value that hits the unique index is already
  // canonical — uniqueness must not depend on how the caller capitalized it.
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(USERNAME_MIN, `Username must be at least ${USERNAME_MIN} characters`)
    .max(USERNAME_MAX, `Username must be at most ${USERNAME_MAX} characters`)
    .regex(
      USERNAME_PATTERN,
      'Username can use letters, numbers, dots and underscores, and must start and end with a letter or number'
    )
    .refine((v) => !isReservedUsername(v), 'That username is not available'),
  // References schools_directory, not schools — any school can sign up,
  // not just launched ones. See DECISIONS.md.
  school_directory_id: z.string().uuid(),
})

export type SignUpInput = z.infer<typeof signUpSchema>

export const addSchoolEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
})

export type AddSchoolEmailInput = z.infer<typeof addSchoolEmailSchema>

export const LISTING_CATEGORIES = [
  'electronics',
  'furniture',
  'clothing',
  'textbooks',
  'appliances',
  'bikes',
  'free',
  'other',
] as const

export const LISTING_CONDITIONS = ['new', 'like_new', 'used', 'for_parts'] as const

export const MAX_LISTING_IMAGES = 5
export const MAX_ACTIVE_LISTINGS = 10

// price is numeric(10,2): anything at or above 100,000,000 overflows and would
// surface as a raw 500 instead of a validation error. Capped well below that.
const MAX_PRICE = 99_999_999.99

// Enum values are stored lowercase (the DB CHECK constraints require it), so
// accept any casing/padding at the edge and canonicalize once, here.
// Non-strings pass through untouched so the enum reports the real type error.
export function normalizeEnumInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value
}

export const FREE_CATEGORY = 'free'

export const listingSchema = z.object({
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().min(1).max(2000),
  // null means free — the schema forbids 0 (CHECK price IS NULL OR price > 0),
  // so a 0 here is a client bug, not "free". Reject it rather than coercing.
  price: z
    .number()
    .positive('Use "free" instead of a price of 0')
    .max(MAX_PRICE)
    .multipleOf(0.01, 'Price can have at most 2 decimal places')
    .nullable(),
  // Case- and whitespace-insensitive: "Free", "FREE", " fRee " all resolve to
  // the canonical lowercase 'free'. The DB CHECK constraints only accept the
  // lowercase forms, so without this an API caller sending "Free" gets an
  // opaque 400 for what is really just a casing difference. The UI's <select>
  // already sends canonical values; this protects the direct-API path.
  // Which campus feed this listing goes into. Optional: omitting it defaults
  // to the seller's own school. The route verifies the school exists AND is
  // active — a client must not be able to file a listing into an arbitrary or
  // unlaunched campus.
  school_id: z.string().uuid().nullable().optional(),
  category: z.preprocess(normalizeEnumInput, z.enum(LISTING_CATEGORIES)),
  condition: z.preprocess(
    normalizeEnumInput,
    z.enum(LISTING_CONDITIONS).nullable().optional()
  ),
  pickup_hint: z.string().trim().max(100).nullable().optional(),
  // Storage object paths, not URLs. The route re-verifies every one of these
  // lives under the caller's own {user_id}/ prefix before insert — a client
  // could otherwise point a "photo" at anything it likes.
  images: z.array(z.string().min(1)).max(MAX_LISTING_IMAGES).default([]),
  // Enforced server-side on purpose: this checkbox is the legal shield that
  // shifts responsibility for prohibited items onto the poster, so a client
  // that simply omits it must not be able to post.
  aup_accepted: z.literal(true, {
    message: 'You must accept the Acceptable Use Policy',
  }),
})
  .transform((data) => ({
    ...data,
    // The 'free' category and a NULL price are the same claim, so they must not
    // be able to disagree. Without this you could post category='free' at $50 —
    // it would sit in the Free category yet be excluded from the "Free items"
    // filter, which keys off `price IS NULL`. Category wins: picking Free is an
    // explicit statement that the item is a giveaway.
    // Note the implication is one-way. A free-priced item in another category
    // (a giveaway textbook) is perfectly valid and stays as-is.
    price: data.category === FREE_CATEGORY ? null : data.price,
  }))

export type ListingInput = z.infer<typeof listingSchema>

export const uploadUrlSchema = z.object({
  content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export type UploadUrlInput = z.infer<typeof uploadUrlSchema>

/**
 * Social links are user-supplied, so only these exact prefixes are allowed
 * (CLAUDE.md). Validated again at RENDER time, not just on save: the column
 * could have been set before this rule existed or written directly in the
 * database, and an unchecked href is a one-click redirect to anywhere.
 */
export const ALLOWED_SOCIAL_PREFIXES = [
  'https://instagram.com/',
  'https://www.instagram.com/',
  'https://linkedin.com/in/',
  'https://www.linkedin.com/in/',
  'https://twitter.com/',
  'https://www.twitter.com/',
  'https://x.com/',
  'https://www.x.com/',
] as const

export function isAllowedSocialUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const trimmed = url.trim().toLowerCase()
  return ALLOWED_SOCIAL_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
}

/** "instagram.com/someone" — the bare host+path, for display next to the link. */
export function socialLabel(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')
}
