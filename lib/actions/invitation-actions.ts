'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InvitationService } from '@/lib/services/invitation-service'
import type {
  SendInvitationParams,
  AssignWorkspacePermissionsParams,
  InvitedUserDetails,
} from '@/lib/services/invitation-service'
import { revalidatePath } from 'next/cache'

/**
 * Send an invitation to a user with organization role
 */
export async function sendInvitation(
  params: Omit<SendInvitationParams, 'inviterId'>
): Promise<{
  success: boolean
  data?: { userId: string; invitationId: string; expiresAt: string; isExistingUser: boolean }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create invitation service instance with admin client for auth operations
    const invitationService = new InvitationService(adminClient)

    // Send invitation
    const result = await invitationService.sendInvitationWithOrgRole({
      ...params,
      inviterId: user.id,
    })

    // Revalidate organization settings page
    revalidatePath(`/organization/${params.orgId}/settings`)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error sending invitation:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to send invitation'
    return { success: false, error: errorMessage }
  }
}

/**
 * Assign workspace permissions to a user
 */
export async function assignWorkspacePermissions(
  params: AssignWorkspacePermissionsParams
): Promise<{
  success: boolean
  data?: { count: number }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create invitation service instance with admin client
    const invitationService = new InvitationService(adminClient)

    // Assign permissions
    const result = await invitationService.assignWorkspacePermissions(
      params,
      user.id
    )

    // Revalidate workspace settings pages
    params.workspacePermissions.forEach(wp => {
      revalidatePath(`/workspace/${wp.workspaceId}/settings`)
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error assigning workspace permissions:', error)
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to assign workspace permissions'
    return { success: false, error: errorMessage }
  }
}

/**
 * Get invited user details
 */
export async function getInvitedUserDetails(
  invitationId: string
): Promise<{
  success: boolean
  data?: InvitedUserDetails
  error?: string
}> {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get current user (for authentication check)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create invitation service instance with admin client
    const invitationService = new InvitationService(adminClient)

    // Get user details
    const details = await invitationService.getInvitedUserDetails(invitationId)

    if (!details) {
      return { success: false, error: 'Invitation not found' }
    }

    return {
      success: true,
      data: details,
    }
  } catch (error) {
    console.error('Error getting invited user details:', error)
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to get invited user details'
    return { success: false, error: errorMessage }
  }
}

/**
 * Accept an invitation
 */
export async function acceptInvitation(
  invitationId: string
): Promise<{
  success: boolean
  data?: { userId: string; alreadyAccepted: boolean }
  error?: string
}> {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create invitation service instance with admin client
    const invitationService = new InvitationService(adminClient)

    // Accept invitation
    const result = await invitationService.acceptInvitation(invitationId)

    // Get invitation details to revalidate paths
    const details = await invitationService.getInvitedUserDetails(invitationId)

    if (details?.orgId) {
      revalidatePath(`/organization/${details.orgId}`)
      revalidatePath(`/organization/${details.orgId}/settings`)
    }

    details?.workspacePermissions.forEach(wp => {
      revalidatePath(`/workspace/${wp.workspaceId}`)
      revalidatePath(`/workspace/${wp.workspaceId}/settings`)
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('Error accepting invitation:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to accept invitation'
    return { success: false, error: errorMessage }
  }
}

export interface InvitationWithDetails {
  id: string
  email: string
  status: string
  userId: string
  orgRole: string
  workspaceCount: number
  expiresAt: string
  createdAt: string
}

/**
 * Get all invitations for an organization with full details including user emails
 */
export async function getOrganizationInvitations(
  organizationId: string
): Promise<{
  success: boolean
  data?: InvitationWithDetails[]
  error?: string
}> {
  try {
    const supabase = await createClient()
    const adminClient = createAdminClient()

    // Get current user (for authentication check)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch all permissions for this organization
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

    if (permissionsError) {
      console.error('Error fetching permissions:', permissionsError)
      return { success: false, error: 'Failed to fetch permissions' }
    }

    console.log('Found permissions:', permissions?.length)

    // Get unique user IDs
    const userIds = [...new Set(permissions?.map(p => p.principal_id) || [])]

    if (userIds.length === 0) {
      return { success: true, data: [] }
    }

    // Fetch invitations for these users
    const { data: invitationsData } = await supabase
      .from('invitations')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })

    if (!invitationsData || invitationsData.length === 0) {
      return { success: true, data: [] }
    }

    // Fetch user emails via admin API
    const invitationsWithDetails: InvitationWithDetails[] = []

    for (const invitation of invitationsData) {
      const permission = permissions?.find(p => p.principal_id === invitation.user_id)
      const roles = permission?.roles as unknown as { name: string; description: string | null }

      // Get workspace count
      const { count } = await supabase
        .from('permissions')
        .select('id', { count: 'exact', head: true })
        .eq('principal_id', invitation.user_id)
        .eq('object_type', 'workspace')
        .eq('org_id', organizationId)

      // Fetch user email from auth.users via admin API using service role client
      const { data: userData } = await adminClient.auth.admin.getUserById(invitation.user_id)
      const userEmail = userData?.user?.email || 'Unknown'

      invitationsWithDetails.push({
        id: invitation.id,
        email: userEmail,
        status: invitation.status,
        userId: invitation.user_id,
        orgRole: roles?.name || 'Unknown',
        workspaceCount: count || 0,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      })
    }

    return {
      success: true,
      data: invitationsWithDetails,
    }
  } catch (error) {
    console.error('Error getting organization invitations:', error)
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Failed to get organization invitations'
    return { success: false, error: errorMessage }
  }
}
