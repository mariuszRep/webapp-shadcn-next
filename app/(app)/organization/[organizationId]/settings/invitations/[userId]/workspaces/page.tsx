import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getInvitedUserDetails } from '@/lib/actions/invitation-actions'
import { WorkspacePermissionsForm } from '@/components/workspace-permissions-form'

interface WorkspacePermissionsPageProps {
  params: Promise<{ organizationId: string; userId: string }>
}

export default async function WorkspacePermissionsPage({ params }: WorkspacePermissionsPageProps) {
  const { organizationId, userId } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch organization workspaces
  const { data: workspaces, error: workspacesError } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  if (workspacesError) {
    redirect(`/organization/${organizationId}/settings/invitations`)
  }

  // Fetch available roles (system roles)
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name, description')
    .is('org_id', null)
    .order('name', { ascending: true })

  if (rolesError) {
    redirect(`/organization/${organizationId}/settings/invitations`)
  }

  // Fetch invited user's latest invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  let invitedUserDetails
  if (invitation) {
    const result = await getInvitedUserDetails(invitation.id)
    if (result.success && result.data) {
      invitedUserDetails = result.data
    }
  }

  if (!invitedUserDetails) {
    // Fallback: fetch user email from auth
    const { data: { user: invitedUser } } = await supabase.auth.admin.getUserById(userId)
    if (!invitedUser) {
      redirect(`/organization/${organizationId}/settings/invitations`)
    }
    invitedUserDetails = {
      email: invitedUser.email || 'Unknown',
      orgRoleName: 'Unknown',
    }
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Workspace Permissions</h1>
        <p className="text-muted-foreground mt-2">
          Assign workspace access for {invitedUserDetails.email}
        </p>
      </div>

      <WorkspacePermissionsForm
        userId={userId}
        organizationId={organizationId}
        userEmail={invitedUserDetails.email}
        orgRoleName={invitedUserDetails.orgRoleName || 'Unknown'}
        workspaces={workspaces || []}
        roles={roles || []}
        existingPermissions={invitedUserDetails.workspacePermissions || []}
      />
    </div>
  )
}
