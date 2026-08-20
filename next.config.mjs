/** @type {import('next').NextConfig} */
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined

const nextConfig = {
  images: {
    // Only the project's own Storage host is allowed. Listing photos are
    // rendered from paths stored in listings.images, and the API verifies
    // those paths live in our bucket — allowing arbitrary remote hosts here
    // would undo that check at the render layer.
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/public/listing-images/**',
          },
        ]
      : [],
  },
}

export default nextConfig
