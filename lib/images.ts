export const MAX_IMAGE_DIMENSION = 1600
export const COMPRESSION_QUALITY = 0.82

export type CompressedImage = {
  blob: Blob
  contentType: 'image/jpeg'
}

/**
 * Downscales and re-encodes an image in the browser before upload.
 *
 * The bandwidth saving is the obvious benefit; the important one is privacy.
 * Phone photos carry EXIF metadata including precise GPS coordinates — a
 * student photographing a desk in their dorm would otherwise publish the
 * location of where they sleep. Drawing to a canvas and re-encoding produces
 * pixels only: every EXIF, GPS, and maker-note block is dropped. Do not
 * "optimize" this into a direct File upload.
 *
 * Always emits JPEG, which also normalizes the content type the signed upload
 * URL is issued for.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('Could not process image')
  }

  // White backdrop so transparent PNGs don't turn black once flattened to JPEG.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', COMPRESSION_QUALITY)
  )

  if (!blob) throw new Error('Could not process image')

  return { blob, contentType: 'image/jpeg' }
}

/**
 * Compresses, requests a signed upload URL, and uploads — returning the
 * Storage object path (not a URL). The path is what gets stored in
 * listings.images and what the API re-verifies ownership of.
 */
export async function uploadListingImage(file: File): Promise<string> {
  const { blob, contentType } = await compressImage(file)

  const res = await fetch('/api/listings/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: contentType }),
  })

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new Error(payload.error ?? 'Could not prepare upload')
  }

  const { path, token } = (await res.json()) as { path: string; token: string }

  const { createClient } = await import('@/lib/supabase/client')
  const supabase = createClient()
  const { error } = await supabase.storage
    .from('listing-images')
    .uploadToSignedUrl(path, token, blob, { contentType })

  if (error) throw new Error('Upload failed')

  return path
}

export function listingImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return `${base}/storage/v1/object/public/listing-images/${path}`
}
