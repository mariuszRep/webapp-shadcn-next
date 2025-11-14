'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/utils/permissions'
import type { Role, PrincipalRoleAssignmentWithRole } from '@/lib/types/rbac'

/**
 * Assign a role to a user in an organization
 */
export async function assignRole(
  orgId: string,
  userId: string,
  roleId: string,
  workspaceId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check permission to manage roles
    await requirePermission('organization', 'manage_roles', orgId)

    // Insert role assignment
    const { error: assignError } = await supabase
      .from('principal_role_assignments')
      .insert({
        principal_kind: 'user',
        principal_id: userId,
        org_id: orgId,
        workspace_id: workspaceId || null,
        role_id: roleId,
        created_by: user.id,
        updated_by: user.id,
      })

    if (assignError) {
      // Check if it's a duplicate assignment
      if (assignError.code === '23505') {
        return { success: false, error: 'User already has this role' }
      }
      console.error('Error assigning role:', assignError)
      return { success: false, error: 'Failed to assign role' }
    }

    // Revalidate settings page
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error assigning role:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Remove a role assignment from a user
 */
export async function removeRole(
  orgId: string,
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check permission to manage roles
    await requirePermission('organization', 'manage_roles', orgId)

    // Delete role assignment
    const { error: deleteError } = await supabase
      .from('principal_role_assignments')
      .delete()
      .eq('id', assignmentId)
      .eq('org_id', orgId)

    if (deleteError) {
      console.error('Error removing role:', deleteError)
      return { success: false, error: 'Failed to remove role' }
    }

    // Revalidate settings page
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error removing role:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get all role assignments for a user in an organization
 */
export async function getUserRoles(
  orgId: string,
  userId: string
): Promise<{ success: boolean; roles?: PrincipalRoleAssignmentWithRole[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch user's role assignments with role details
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
      console.error('Error fetching user roles:', error)
      return { success: false, error: 'Failed to fetch roles' }
    }

    return { success: true, roles: data as any }
  } catch (error) {
    console.error('Unexpected error fetching user roles:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Get all available roles
 */
export async function getAvailableRoles(): Promise<{ success: boolean; roles?: Role[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch all roles
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching roles:', error)
      return { success: false, error: 'Failed to fetch roles' }
    }

    return { success: true, roles: data }
  } catch (error) {
    console.error('Unexpected error fetching roles:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
