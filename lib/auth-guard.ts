import { createClient, createServiceClient } from '@/lib/supabase/server'

export type SellerContext = {
  userId: string
  schoolId: string
}

export type GuardFailure = {
  error: string
  status: number
}

/**
 * Authorizes a seller action (posting or editing a listing, requesting an
 * upload URL).
 *
 * This exists because middleware.ts does NOT cover /api/* — its matcher lists
 * page routes only (/account/:path*, /listings/new, /listings/:id/edit). The
 * page redirect is therefore a UX affordance, not a security boundary: any
 * client can POST straight to the API. Every seller-side route must call this
 * itself.
 *
 * Checks, in order: a real session, a profile row, not suspended, not
 * soft-deleted, and is_seller_verified (a verified SCHOOL email — not merely
 * any verified email; see DECISIONS.md "Own email verification system").
 */
export async function requireVerifiedSeller(): Promise<
  { ok: true; context: SellerContext } | { ok: false; failure: GuardFailure }
> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, failure: { error: 'You must be signed in', status: 401 } }
  }

  // Service role: is_suspended/deleted_at are readable under the public RLS
  // policy only for rows that policy already lets through, so a suspended
  // user's row would simply be invisible rather than visibly suspended.
  // Reading with the service role distinguishes "suspended" from "missing".
  const serviceClient = createServiceClient()
  const { data: profile, error } = await serviceClient
    .from('users')
    .select('id, school_id, is_seller_verified, is_suspended, deleted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !profile) {
    return { ok: false, failure: { error: 'Profile not found', status: 403 } }
  }
  if (profile.deleted_at) {
    return { ok: false, failure: { error: 'This account has been deleted', status: 403 } }
  }
  if (profile.is_suspended) {
    return { ok: false, failure: { error: 'This account is suspended', status: 403 } }
  }
  if (!profile.is_seller_verified) {
    return {
      ok: false,
      failure: {
        error: 'Verify your school email before posting a listing',
        status: 403,
      },
    }
  }

  return { ok: true, context: { userId: profile.id, schoolId: profile.school_id } }
}
