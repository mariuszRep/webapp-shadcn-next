import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvitationsTable } from '@/components/invitations-table'

interface InvitationsPageProps {
  params: Promise<{ organizationId: string }>
}

export default async function InvitationsPage({ params }: InvitationsPageProps) {
  const { organizationId } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch organization details
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', organizationId)
    .single()

  if (orgError || !organization) {
    redirect('/settings')
  }

  // Fetch all invitations for this organization
  // Join with permissions to get invitation data
  const { data: permissions } = await supabase
    .from('permissions')
    .select(`
      id,
      principal_id,
      role_id,
      created_at,
      roles!inner(
        name,
        description
      )
    `)
    .eq('object_type', 'organization')
    .eq('object_id', organizationId)
    .eq('principal_type', 'user')

  // Get unique user IDs
  const userIds = [...new Set(permissions?.map(p => p.principal_id) || [])]

  // Fetch invitations for these users
  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .in('user_id', userIds)
    .order('created_at', { ascending: false })

  // Fetch user emails via admin API
  const usersData = await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await supabase.auth.admin.getUserById(userId)
      return data.user
    })
  )

  // Create a map of userId to email
  const userEmailMap = new Map(
    usersData.filter(Boolean).map(user => [user!.id, user!.email || 'Unknown'])
  )

  // Fetch workspace permissions for the organization
  const { data: workspacePermissions } = await supabase
    .from('permissions')
    .select('principal_id')
    .eq('object_type', 'workspace')
    .eq('org_id', organizationId)

  // Count permissions per user
  const workspacePermissionsCounts = userIds.map(userId => {
    const count = workspacePermissions?.filter(p => p.principal_id === userId).length || 0
    return { userId, count }
  })

  const workspaceCountMap = new Map(
    workspacePermissionsCounts.map(({ userId, count }) => [userId, count])
  )

  // Combine data
  const invitationsWithDetails = invitations?.map(invitation => {
    const permission = permissions?.find(p => p.principal_id === invitation.user_id)
    const roles = permission?.roles as unknown as { name: string; description: string | null } | null
    return {
      id: invitation.id,
      email: userEmailMap.get(invitation.user_id) || 'Unknown',
      status: invitation.status,
      userId: invitation.user_id,
      orgRole: roles?.name || 'Unknown',
      workspaceCount: workspaceCountMap.get(invitation.user_id) || 0,
      expiresAt: invitation.expires_at,
      createdAt: invitation.created_at,
    }
  }) || []

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invitations</h1>
          <p className="text-muted-foreground mt-2">
            Manage user invitations for {organization.name}
          </p>
        </div>
      </div>

      <InvitationsTable
        organizationId={organizationId}
        invitations={invitationsWithDetails}
      />
    </div>
  )
}
