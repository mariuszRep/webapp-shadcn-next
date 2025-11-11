import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
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
