import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingFlow } from '@/components/onboarding-flow'

export default async function OnboardingPage() {
  const supabase = await createClient()

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Trust middleware - if we're on this page, user has no organizations
  // Middleware already checked and redirected users without orgs here
  // No need to check again (avoids blocking materialized view refresh)

  // Check for pending invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, status, expires_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let invitationDetails = null

  if (invitation) {
    // Check if invitation is expired
    const now = new Date()
    const expiresAt = new Date(invitation.expires_at)

    if (now > expiresAt) {
      // Mark as expired
      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
    } else {
      // Get invitation details with organization and role info
      const { data: permissions } = await supabase
        .from('permissions')
        .select('object_id, role_id, roles!inner(name, description)')
        .eq('object_type', 'organization')
        .limit(1)
        .maybeSingle()

      if (permissions) {
        // Get organization name
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', permissions.object_id)
          .single()

        // Get workspace permissions count
        const { data: workspacePerms, count } = await supabase
          .from('permissions')
          .select('id', { count: 'exact', head: true })
          .eq('object_type', 'workspace')

        const roles = permissions.roles as unknown as { name: string; description: string | null }

        invitationDetails = {
          invitationId: invitation.id,
          organizationId: org?.id || '',
          organizationName: org?.name || 'Unknown Organization',
          roleName: roles?.name || 'Unknown',
          roleDescription: roles?.description || null,
          workspaceCount: count || 0,
        }
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <OnboardingFlow
        userEmail={user.email || ''}
        invitationDetails={invitationDetails}
      />
    </div>
  )
}
