'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/utils/permissions'
import type { OrganizationMemberWithUser } from '@/lib/types/rbac'

/**
 * Invite a user to an organization
 */
export async function inviteOrgMember(
  orgId: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Valid email is required' }
    }

    // Check permission to manage members
    await requirePermission('organization', 'manage_members', orgId)

    // Create admin client for invite operation
    const adminClient = createAdminClient()

    // Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          organization_id: orgId,
        },
      }
    )

    if (inviteError) {
      console.error('Error inviting user:', inviteError)
      return { success: false, error: 'Failed to send invitation' }
    }

    if (!inviteData.user) {
      return { success: false, error: 'Failed to create user invitation' }
    }

    // Add user to organization_members using admin client (bypasses RLS)
    const { error: memberError } = await adminClient
      .from('organization_members')
      .insert({
        org_id: orgId,
        user_id: inviteData.user.id,
        created_by: user.id,
        updated_by: user.id,
      })

    if (memberError) {
      console.error('Error adding organization member:', memberError)
      return { success: false, error: 'Failed to add member to organization' }
    }

    // Create a personal workspace for the invited user in this organization
    const { data: newWorkspace, error: workspaceError } = await adminClient
      .from('workspaces')
      .insert({
        name: `${inviteData.user.email?.split('@')[0] || 'User'}'s Workspace`,
        organization_id: orgId,
        created_by: inviteData.user.id,
        updated_by: inviteData.user.id,
      })
      .select()
      .single()

    if (workspaceError) {
      console.error('Error creating workspace for invited user:', workspaceError)
      return { success: false, error: 'Failed to create workspace for invited user' }
    }

    console.log(`Created workspace for invited user: ${newWorkspace.id}`)

    // Get org_member and workspace_owner roles
    const { data: orgMemberRole } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', 'org_member')
      .is('deleted_at', null)
      .single()

    const { data: workspaceOwnerRole } = await adminClient
      .from('roles')
      .select('id')
      .eq('name', 'workspace_owner')
      .is('deleted_at', null)
      .single()

    // Assign org_member role to the invited user
    if (orgMemberRole) {
      const { error: roleError } = await adminClient
        .from('principal_role_assignments')
        .insert({
          principal_kind: 'user',
          principal_id: inviteData.user.id,
          org_id: orgId,
          workspace_id: null,
          role_id: orgMemberRole.id,
          created_by: user.id,
          updated_by: user.id,
        })

      if (roleError && roleError.code !== '23505') {
        console.error('Error assigning org_member role:', roleError)
        // Don't fail the invitation if role assignment fails
      }
    }

    // Assign workspace_owner role for their personal workspace
    if (workspaceOwnerRole) {
      const { error: wsRoleError } = await adminClient
        .from('principal_role_assignments')
        .insert({
          principal_kind: 'user',
          principal_id: inviteData.user.id,
          org_id: orgId,
          workspace_id: newWorkspace.id,
          role_id: workspaceOwnerRole.id,
          created_by: user.id,
          updated_by: user.id,
        })

      if (wsRoleError && wsRoleError.code !== '23505') {
        console.error('Error assigning workspace_owner role:', wsRoleError)
        // Don't fail the invitation if role assignment fails
      }
    }

    // Revalidate settings page
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error inviting member:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Remove a member from an organization
 * This will cascade delete their role assignments
 */
export async function removeOrgMember(
  orgId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Cannot remove self
    if (userId === user.id) {
      return { success: false, error: 'Cannot remove yourself from the organization' }
    }

    // Check permission to manage members
    await requirePermission('organization', 'manage_members', orgId)

    // Delete organization member (cascade will delete role assignments)
    const { error: deleteError } = await supabase
      .from('organization_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Error removing organization member:', deleteError)
      return { success: false, error: 'Failed to remove member' }
    }

    // Revalidate settings page
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error removing member:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get all members of an organization
 */
export async function getOrgMembers(
  orgId: string
): Promise<{ success: boolean; members?: OrganizationMemberWithUser[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch organization members with user details
    const { data, error } = await supabase
      .from('organization_members')
      .select(`
        *,
        user:user_id (
          id,
          email
        )
      `)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching organization members:', error)
      return { success: false, error: 'Failed to fetch members' }
    }

    return { success: true, members: data as any }
  } catch (error) {
    console.error('Unexpected error fetching members:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
