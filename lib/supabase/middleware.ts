import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/signup') &&
    !request.nextUrl.pathname.startsWith('/forgot-password') &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    request.nextUrl.pathname !== '/'
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Onboarding check: redirect users without organization membership to /onboarding
  if (user) {
    const pathname = request.nextUrl.pathname

    // Skip onboarding check for these paths to prevent redirect loops
    const skipOnboardingCheck =
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/forgot-password') ||
      pathname === '/'

    if (!skipOnboardingCheck) {
      // Check if user has organization membership or global access
      const { data: memberships } = await supabase
        .from('users_permissions')
        .select('object_type')
        .eq('user_id', user.id)
        .in('object_type', ['organization', 'system'])

      const hasOrganizations = memberships?.some((m) => m.object_type === 'organization')
      const isGlobalOwner = memberships?.some((m) => m.object_type === 'system')

      // Global Owner Logic
      if (isGlobalOwner) {
        // Redirect to settings if on onboarding or root, otherwise allow access
        if (pathname === '/' || pathname.startsWith('/onboarding')) {
          const url = request.nextUrl.clone()
          url.pathname = '/settings'
          return NextResponse.redirect(url)
        }
      } else {
        // Regular User Logic
        // Redirect to onboarding if user has no organizations
        if (!hasOrganizations) {
          const url = request.nextUrl.clone()
          url.pathname = '/onboarding'
          const response = NextResponse.redirect(url)
          // Copy cookies from supabaseResponse to maintain session
          const cookies = supabaseResponse.cookies.getAll()
          cookies.forEach((cookie) => {
            response.cookies.set(cookie.name, cookie.value)
          })
          return response
        }
      }
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely.

  return supabaseResponse
}
