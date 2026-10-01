import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === 'true'

/**
 * Pre-launch gate.
 *
 * Until NEXT_PUBLIC_LAUNCHED is true, the only thing this site offers is the
 * teaser and its waitlist. Everything else — sign-up, sign-in, listings,
 * messages, account — is unreachable.
 *
 * DENY BY DEFAULT. The allow-list below names what stays open; anything not on
 * it is blocked. The inverse (listing what to block) silently exposes every
 * route added later, which is exactly how /sign-up and /listings/new ended up
 * publicly reachable on production while the homepage still showed a teaser.
 *
 * API routes are gated too, not just pages. Blocking the /sign-up page while
 * POST /api/auth/sign-up stays open just moves the door — an account could
 * still be created with a single curl.
 */
const PUBLIC_PAGES = new Set(['/', '/about'])

// The waitlist form is the teaser's entire purpose, so its route stays open.
const PUBLIC_API = new Set(['/api/waitlist'])

function isAllowedPreLaunch(pathname: string): boolean {
  if (PUBLIC_PAGES.has(pathname)) return true
  if (PUBLIC_API.has(pathname)) return true
  return false
}

// Posting requires a verified *school* email (is_seller_verified), not just
// any verified email. See DECISIONS.md "Own email verification system".
const VERIFIED_ONLY_PATHS = ['/listings/new']
const VERIFIED_ONLY_PATTERN = /^\/listings\/[^/]+\/edit$/

// Routes that require a session once the app IS launched. Browsing stays open
// per CLAUDE.md's "no login wall" decision.
const SESSION_REQUIRED_PREFIXES = ['/account', '/messages']
const SESSION_REQUIRED_PATHS = ['/listings/new']

function requiresSession(pathname: string): boolean {
  if (SESSION_REQUIRED_PATHS.includes(pathname)) return true
  if (VERIFIED_ONLY_PATTERN.test(pathname)) return true
  return SESSION_REQUIRED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  if (!LAUNCHED && !isAllowedPreLaunch(pathname)) {
    // APIs get a flat 404 rather than a redirect or a 503: a redirect is
    // meaningless to a fetch client, and "service unavailable" advertises that
    // the endpoint exists and is worth retrying later.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (!requiresSession(pathname)) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

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

/**
 * Matches every request except Next's own assets and static files.
 *
 * Deliberately broad: the pre-launch gate is only as good as its coverage, and
 * a narrow matcher means any route missing from it is silently reachable. The
 * exclusions are framework internals and files served straight from /public.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
