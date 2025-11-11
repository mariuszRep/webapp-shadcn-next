'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signIn, sendMagicLink } from '@/app/actions/auth'

export function LoginForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [isMagicLink, setIsMagicLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (isMagicLink) {
        const result = await sendMagicLink(formData)
        if (result.error) {
          setError(result.error)
        } else {
          setMessage('Check your email for the magic link!')
        }
      } else {
        const result = await signIn(formData)
        if (result.error) {
          setError(result.error)
        }
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Sign in to your account to continue
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              disabled={isLoading}
            />
          </div>

          {!isMagicLink && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          {message && (
            <div className="text-sm text-green-500 dark:text-green-400">
              {message}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Loading...' : isMagicLink ? 'Send Magic Link' : 'Sign In'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setIsMagicLink(!isMagicLink)}
            disabled={isLoading}
          >
            {isMagicLink ? 'Use password instead' : 'Use magic link instead'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
