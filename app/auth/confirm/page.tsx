'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Client-side page to handle hash-based authentication
 * Used for invitation emails which use the implicit flow
 */
export default function AuthConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleHashAuth = async () => {
      const supabase = createClient()

      // Get the next redirect path
      const next = searchParams.get('next') || '/portal'

      console.log('[AUTH CONFIRM] Starting auth confirmation')
      console.log('[AUTH CONFIRM] Full URL:', window.location.href)
      console.log('[AUTH CONFIRM] Window hash:', window.location.hash)
      console.log('[AUTH CONFIRM] Search params:', window.location.search)

      try {
        // Parse hash parameters manually
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        const type = hashParams.get('type')
        const error = hashParams.get('error')
        const errorDescription = hashParams.get('error_description')

        console.log('[AUTH CONFIRM] Hash params:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken,
          type,
          error,
          errorDescription
        })

        // Check for errors in hash
        if (error) {
          console.error('[AUTH CONFIRM] Error in hash:', error, errorDescription)
          setError(errorDescription || error)
          setTimeout(() => {
            router.push(`/login?error=${encodeURIComponent(errorDescription || error)}`)
          }, 3000)
          return
        }

        if (accessToken && refreshToken) {
          console.log('[AUTH CONFIRM] Setting session from hash tokens...')

          // Set the session manually
          const { data, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (setSessionError) {
            console.error('[AUTH CONFIRM] Failed to set session:', setSessionError)
            setError(setSessionError.message)
            setTimeout(() => {
              router.push(`/login?error=${encodeURIComponent(setSessionError.message)}`)
            }, 2000)
            return
          }

          if (data.session) {
            console.log('[AUTH CONFIRM] Session established successfully!')
            console.log('[AUTH CONFIRM] User:', data.session.user.email)

            // Clear the hash from URL
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search)

            // Redirect to portal
            setTimeout(() => router.push(next), 100)
          } else {
            console.error('[AUTH CONFIRM] Session set but no session returned')
            setError('Failed to establish session')
            setTimeout(() => {
              router.push('/login?error=Failed%20to%20establish%20session')
            }, 2000)
          }
        } else {
          console.error('[AUTH CONFIRM] Missing tokens in hash')
          setError('Invalid authentication link')
          setTimeout(() => {
            router.push('/login?error=Invalid%20authentication%20link')
          }, 2000)
        }
      } catch (err) {
        console.error('[AUTH CONFIRM] Error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
        setTimeout(() => {
          router.push('/login?error=Authentication%20failed')
        }, 2000)
      }
    }

    handleHashAuth()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-bold text-red-600">Authentication Failed</h1>
            <p className="mt-2 text-gray-600">{error}</p>
            <p className="mt-4 text-sm text-gray-500">Redirecting to login...</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Confirming your account...</h1>
            <p className="mt-2 text-gray-600">Please wait while we sign you in.</p>
            <div className="mt-4">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
