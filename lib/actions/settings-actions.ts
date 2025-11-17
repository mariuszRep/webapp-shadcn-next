'use server'

import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/utils/permissions'
import type { OrganizationMemberWithUser, Role, PrincipalRoleAssignmentWithRole } from '@/lib/types/rbac'

/**
 * Get organization settings data including members and roles
 */
export async function getOrganizationSettings(orgId: string): Promise<{
  success: boolean
  canManageMembers: boolean
  canManageRoles: boolean
  members?: OrganizationMemberWithUser[]
  availableRoles?: Role[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, canManageMembers: false, canManageRoles: false, error: 'Unauthorized' }
    }

    // Check permissions
    const canManageMembers = await hasPermission('organization', 'manage_members', orgId)
    const canManageRoles = await hasPermission('organization', 'manage_roles', orgId)

    // If user doesn't have any management permissions, return early
    if (!canManageMembers && !canManageRoles) {
      return {
        success: true,
        canManageMembers: false,
        canManageRoles: false,
      }
    }

    // Fetch organization members if user can manage them
    let members: OrganizationMemberWithUser[] | undefined
    if (canManageMembers) {
      const { data: membersData, error: membersError } = await supabase
        .from('organization_members_with_users')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })

      if (membersError) {
        console.error('Error fetching members:', membersError)
      } else {
        // Transform view data to match expected format
        members = membersData?.map(row => ({
          org_id: row.org_id,
          user_id: row.user_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          created_by: row.created_by,
          updated_by: row.updated_by,
          deleted_at: row.deleted_at,
          user: {
            id: row.user_id,
            email: row.user_email,
          },
        })) as any
      }
    }

    // Fetch available roles if user can manage roles
    let availableRoles: Role[] | undefined
    if (canManageRoles) {
      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true })

      if (rolesError) {
        console.error('Error fetching roles:', rolesError)
      } else {
        availableRoles = rolesData
      }
    }

    return {
      success: true,
      canManageMembers,
      canManageRoles,
      members,
      availableRoles,
    }
  } catch (error) {
    console.error('Unexpected error fetching organization settings:', error)
    return {
      success: false,
      canManageMembers: false,
      canManageRoles: false,
      error: 'An unexpected error occurred',
    }
  }
}

/**
 * Get user role assignments for a specific organization member
 */
export async function getMemberRoles(
  orgId: string,
  userId: string
): Promise<{
  success: boolean
  roles?: PrincipalRoleAssignmentWithRole[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check permission to manage roles
    const canManageRoles = await hasPermission('organization', 'manage_roles', orgId)
    if (!canManageRoles) {
      return { success: false, error: 'Permission denied' }
    }

    // Fetch user's role assignments
    const { data, error } = await supabase
      .from('principal_role_assignments')
      .select(`
        *,
        role:role_id (*)
      `)
      .eq('org_id', orgId)
      .eq('principal_kind', 'user')
      .eq('principal_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching member roles:', error)
      return { success: false, error: 'Failed to fetch roles' }
    }

    return { success: true, roles: data as any }
  } catch (error) {
    console.error('Unexpected error fetching member roles:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
