import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { acceptInvitation } from '@/lib/actions/invitation-actions'

export default async function PortalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check for pending invitation and accept it on first login
  const { data: pendingInvitation } = await supabase
    .from('invitations')
    .select('id, status, expires_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingInvitation) {
    // Check if not expired
    const now = new Date()
    const expiresAt = new Date(pendingInvitation.expires_at)

    if (now <= expiresAt) {
      // Accept the invitation
      await acceptInvitation(pendingInvitation.id)
    } else {
      // Mark as expired
      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', pendingInvitation.id)
    }
  }

  // Get user's organizations using users_permissions view
  const { data: orgPermissions } = await supabase
    .from('users_permissions')
    .select('object_id, org_id')
    .eq('object_type', 'organization')
    .order('object_id', { ascending: true })

  if (!orgPermissions || orgPermissions.length === 0) {
    // No organizations - redirect to onboarding
    redirect('/onboarding')
  }

  // Get first organization
  const firstOrgId = orgPermissions[0].object_id

  if (!firstOrgId) {
    redirect('/onboarding')
  }

  // Get user's workspace permissions for this organization
  const { data: workspacePermissions } = await supabase
    .from('users_permissions')
    .select('object_id, role_name, role_permissions')
    .eq('object_type', 'workspace')
    .eq('org_id', firstOrgId)
    .order('object_id', { ascending: true })
    .limit(1)

  // If user has workspace access, redirect to first workspace
  if (workspacePermissions && workspacePermissions.length > 0) {
    const firstWorkspaceId = workspacePermissions[0].object_id
    if (firstWorkspaceId) {
      redirect(`/organization/${firstOrgId}/workspace/${firstWorkspaceId}`)
    }
  }

  // No workspace access - check if user has permission to create workspaces
  const { data: orgPermission } = await supabase
    .from('users_permissions')
    .select('role_permissions')
    .eq('object_type', 'organization')
    .eq('object_id', firstOrgId)
    .maybeSingle()

  // Check if user has insert permission (can create workspaces)
  const rolePermissions = orgPermission?.role_permissions as string[] | null
  const canCreateWorkspace = rolePermissions?.includes('insert') || false

  if (canCreateWorkspace) {
    // User can create workspaces - redirect to settings to create one
    redirect(`/organization/${firstOrgId}/settings?error=no_workspace`)
  }

  // User cannot create workspaces - redirect to organization page with message
  redirect(`/organization/${firstOrgId}/settings?error=no_workspace_access`)
}
