import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireVerifiedSeller } from '@/lib/auth-guard'
import { uploadUrlSchema } from '@/lib/validations'

const BUCKET = 'listing-images'

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Issues a short-lived signed upload URL, scoped to a path inside the caller's
 * own {user_id}/ prefix.
 *
 * Gating the URL behind requireVerifiedSeller() means an unverified or
 * suspended account cannot move a single byte into Storage — the check happens
 * before the upload, not after. The filename is server-generated (uuid +
 * extension derived from the validated content type), so a client-supplied
 * name can never influence the stored path.
 */
export async function POST(request: Request) {
  const guard = await requireVerifiedSeller()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.failure.error }, { status: guard.failure.status })
  }

  const body = await request.json().catch(() => null)
  const parsed = uploadUrlSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }

  const extension = EXTENSIONS[parsed.data.content_type]
  const path = `${guard.context.userId}/${randomUUID()}.${extension}`

  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient.storage.from(BUCKET).createSignedUploadUrl(path)

  if (error || !data) {
    console.error('[upload-url] could not create signed upload url', error)
    return NextResponse.json({ error: 'Could not prepare upload' }, { status: 500 })
  }

  return NextResponse.json({ path: data.path, token: data.token })
}
