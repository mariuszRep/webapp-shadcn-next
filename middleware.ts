import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply rate limiting to auth endpoints
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth/callback')
  ) {
    const ip = getClientIp(request)

    // Different limits for different endpoints
    const limits = {
      '/login': { name: 'auth-login', limit: 5, windowSeconds: 60 }, // 5 per minute
      '/signup': { name: 'auth-signup', limit: 3, windowSeconds: 300 }, // 3 per 5 minutes
      '/auth/callback': { name: 'auth-callback', limit: 10, windowSeconds: 60 }, // 10 per minute
    }

    // Find matching limit config
    const limitConfig = Object.entries(limits).find(([path]) =>
      pathname.startsWith(path)
    )?.[1]

    if (limitConfig) {
      const result = rateLimit(ip, limitConfig)

      if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
        return new NextResponse('Too many requests. Please try again later.', {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limitConfig.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.reset.toString(),
          },
        })
      }

      // Add rate limit headers to successful requests
      const response = await handleAuthErrorsAndUpdateSession(request)
      response.headers.set('X-RateLimit-Limit', limitConfig.limit.toString())
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
      response.headers.set('X-RateLimit-Reset', result.reset.toString())
      return response
    }
  }

  // No rate limiting for other routes
  return await handleAuthErrorsAndUpdateSession(request)
}

async function handleAuthErrorsAndUpdateSession(request: NextRequest) {
  // Handle auth errors that Supabase redirects to root
  if (request.nextUrl.pathname === '/') {
    const errorDescription = request.nextUrl.searchParams.get('error_description')
    const errorCode = request.nextUrl.searchParams.get('error_code')

    if (errorDescription || errorCode) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      // Keep the error_description param for the login page to display
      if (!url.searchParams.has('error')) {
        url.searchParams.set('error', errorDescription || 'Authentication failed')
      }
      url.searchParams.delete('error_code')
      url.searchParams.delete('error_description')
      url.searchParams.delete('access_denied')

      return NextResponse.redirect(url)
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
