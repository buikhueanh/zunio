import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Posting requires a verified *school* email (is_seller_verified), not just
// any verified email — everything else under the matcher below only
// requires a session. See DECISIONS.md "Own email verification system".
const VERIFIED_ONLY_PATHS = ['/listings/new']
const VERIFIED_ONLY_PATTERN = /^\/listings\/[^/]+\/edit$/

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return NextResponse.redirect(new URL('/sign-in', request.url))
  }

  const pathname = request.nextUrl.pathname
  const requiresVerification =
    VERIFIED_ONLY_PATHS.includes(pathname) || VERIFIED_ONLY_PATTERN.test(pathname)

  if (requiresVerification) {
    const { data: profile } = await supabase
      .from('users')
      .select('is_seller_verified')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!profile?.is_seller_verified) {
      return NextResponse.redirect(new URL('/check-email', request.url))
    }
  }

  return response
}

// Only these routes require a session — browsing stays open per CLAUDE.md's
// "no login wall" decision. Add new protected paths here as they're built.
export const config = {
  matcher: ['/account/:path*', '/listings/new', '/listings/:id/edit'],
}
