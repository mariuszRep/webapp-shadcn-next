import Link from 'next/link'
import { SignupForm } from '@/components/auth/signup-form'
import { OAuthButtons } from '@/components/auth/oauth-buttons'

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <SignupForm />
      <OAuthButtons />
      <div className="text-center text-sm">
        Already have an account?{' '}
        <Link href="/login" className="text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
