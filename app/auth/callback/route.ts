import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error_description = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/portal'

  console.log('[AUTH CALLBACK]', { code: code?.substring(0, 20) + '...', error_description, next, origin })

  // Handle Supabase auth errors (like expired OTP)
  if (error_description) {
    console.log('[AUTH CALLBACK] Error from Supabase:', error_description)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_description)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.log('[AUTH CALLBACK] Session exchange failed:', error)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    console.log('[AUTH CALLBACK] Session exchange successful, redirecting to:', next)
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
  console.log('[AUTH CALLBACK] No code provided')
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
