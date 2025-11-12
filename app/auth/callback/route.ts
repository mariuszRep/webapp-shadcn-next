import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Validates that a redirect path is safe (relative path only)
 * Prevents open redirect vulnerabilities
 */
function isValidRedirectPath(path: string): boolean {
  // Must start with / but not //
  if (!path.startsWith('/') || path.startsWith('//')) {
    return false
  }

  // Must not contain protocol (no absolute URLs)
  if (path.includes('://')) {
    return false
  }

  // Must not contain backslashes (windows path separator)
  if (path.includes('\\')) {
    return false
  }

  return true
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_description = searchParams.get('error_description')
  const nextParam = searchParams.get('next') ?? '/portal'

  // Validate and sanitize redirect path
  const next = isValidRedirectPath(nextParam) ? nextParam : '/portal'

  if (process.env.NODE_ENV === 'development') {
    console.log('[AUTH CALLBACK]', { code: code?.substring(0, 20) + '...', error_description, next, origin })
  }

  // Handle Supabase auth errors (like expired OTP)
  if (error_description) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH CALLBACK] Error from Supabase:', error_description)
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AUTH CALLBACK] Session exchange failed:', error)
      }
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('[AUTH CALLBACK] Session exchange successful, redirecting to:', next)
    }
    const forwardedHost = request.headers.get('x-forwarded-host')
    const isLocalEnv = process.env.NODE_ENV === 'development'

    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`)
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`)
    } else {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUTH CALLBACK] No code provided')
  }
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
