import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getUserOrganizations } from '@/lib/actions/organization-actions'
import { SettingsClient } from '@/components/settings-client'
import { Skeleton } from '@/components/ui/skeleton'

function SettingsError({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Unable to load settings</h1>
        <p className="text-muted-foreground mt-3 text-sm">{message}</p>
      </div>
    </div>
  )
}

async function SettingsContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const result = await getUserOrganizations()

  if (!result.success) {
    return <SettingsError message={result.error || 'Failed to load organizations'} />
  }

  const userData = {
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    avatar: user.user_metadata?.avatar_url || '',
  }

  return (
    <SettingsClient
      organizations={result.organizations || []}
      user={userData}
    />
  )
}

function SettingsLoading() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-full flex-col gap-4 p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  )
}
