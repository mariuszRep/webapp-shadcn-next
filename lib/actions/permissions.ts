'use server'

import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  Database,
  PrincipalType,
  ObjectType,
  PermissionAction,
  Permission,
  Role,
  WorkspaceMemberView
} from '@/lib/types/database'

// =====================================================
// VALIDATION SCHEMAS
// =====================================================

const permissionActionEnum = z.enum(['select', 'insert', 'update', 'delete'])
const objectTypeEnum = z.enum(['organization', 'workspace'])

export const addPermissionSchema = z.object({
  principal_id: z.string().uuid('Invalid user ID'),
  role_id: z.string().uuid('Invalid role ID'),
  object_type: objectTypeEnum,
  object_id: z.string().uuid('Invalid object ID').nullable(),
})

export type AddPermissionInput = z.infer<typeof addPermissionSchema>

// Form schema (without org_id - it's added programmatically)
export const roleFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  permissions: z
    .array(permissionActionEnum)
    .min(1, 'At least one permission is required'),
})

export type RoleFormInput = z.infer<typeof roleFormSchema>

// Server action schema (includes org_id)
export const addRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name must be less than 100 characters'),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  permissions: z
    .array(permissionActionEnum)
    .min(1, 'At least one permission is required'),
  org_id: z.string().uuid('Invalid organization ID'),
})

export type AddRoleInput = z.infer<typeof addRoleSchema>

export const updateRoleSchema = z.object({
  name: z
    .string()
    .min(1, 'Role name is required')
    .max(100, 'Role name must be less than 100 characters')
    .optional(),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
  permissions: z.array(permissionActionEnum).optional(),
})

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

// =====================================================
// RLS ERROR HANDLER
// =====================================================

/**
 * Utility to convert PostgreSQL RLS policy violations into user-friendly error messages
 */
function handleRLSError(error: any): string {
  if (!error) return 'An unexpected error occurred'

  const errorMessage = error.message || ''
  const errorCode = error.code || ''

  // RLS policy violation
  if (errorCode === '42501' || errorMessage.includes('policy')) {
    return 'You do not have permission to perform this action'
  }

  // Foreign key violation
  if (errorCode === '23503') {
    return 'This operation would violate data relationships'
  }

  // Unique constraint violation
  if (errorCode === '23505') {
    return 'This record already exists'
  }

  // Not null violation
  if (errorCode === '23502') {
    return 'Required field is missing'
  }

  // Check constraint violation
  if (errorCode === '23514') {
    return 'Data validation failed'
  }

  // Generic fallback
  return error.message || 'An unexpected error occurred'
}

// =====================================================
// ROLE SERVICE
// =====================================================

export interface CreateRoleInput {
  name: string
  description?: string
  permissions: PermissionAction[]
  org_id: string
}

export interface UpdateRoleInput {
  name?: string
  description?: string
  permissions?: PermissionAction[]
}

class RoleService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async createRole(data: CreateRoleInput): Promise<{
    success: boolean
    role?: Role
    error?: string
  }> {
    try {
      const { data: role, error } = await this.supabase
        .from('roles')
        .insert({
          name: data.name,
          description: data.description || null,
          permissions: data.permissions,
          org_id: data.org_id,
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating role:', error)
        return { success: false, error: error.message }
      }

      return { success: true, role: role as Role }
    } catch (error) {
      console.error('Error creating role:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async updateRole(
    id: string,
    data: UpdateRoleInput
  ): Promise<{
    success: boolean
    role?: Role
    error?: string
  }> {
    try {
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description
      if (data.permissions !== undefined) updateData.permissions = data.permissions

      const { data: role, error } = await this.supabase
        .from('roles')
        .update(updateData)
        .eq('id', id)
        .is('deleted_at', null)
        .select()
        .single()

      if (error) {
        console.error('Error updating role:', error)
        return { success: false, error: error.message }
      }

      return { success: true, role: role as Role }
    } catch (error) {
      console.error('Error updating role:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async deleteRole(id: string): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const { error } = await this.supabase
        .from('roles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .is('deleted_at', null)

      if (error) {
        console.error('Error deleting role:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting role:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async getRoles(orgId?: string): Promise<{
    success: boolean
    roles?: Role[]
    error?: string
  }> {
    try {
      let query = this.supabase
        .from('roles')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (orgId) {
        query = query.or(`org_id.eq.${orgId},org_id.is.null`)
      } else {
        query = query.is('org_id', null)
      }

      const { data: roles, error } = await query

      if (error) {
        console.error('Error fetching roles:', error)
        return { success: false, error: error.message }
      }

      return { success: true, roles: roles as Role[] }
    } catch (error) {
      console.error('Error fetching roles:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

// =====================================================
// TYPES
// =====================================================

interface AssignRoleParams {
  org_id: string
  principal_type: PrincipalType
  principal_id: string
  role_id: string
  object_type: ObjectType
  object_id: string | null
}

interface CheckPermissionParams {
  user_id: string
  object_type: ObjectType
  object_id: string
  action: PermissionAction
}

interface PermissionWithDetails extends Permission {
  role?: Role
  user_email?: string
  user_name?: string
}

// =====================================================
// ASSIGN ROLE
// =====================================================

export async function assignRole(params: AssignRoleParams): Promise<{
  success: boolean
  permission?: Permission
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Business logic validation only
    if (params.principal_type !== 'user') {
      return { success: false, error: 'Only user principal type is currently supported' }
    }

    // Check for duplicate permission (better UX than constraint error)
    const { data: existingPermission } = await supabase
      .from('permissions')
      .select('id')
      .eq('org_id', params.org_id)
      .eq('principal_type', params.principal_type)
      .eq('principal_id', params.principal_id)
      .eq('role_id', params.role_id)
      .eq('object_type', params.object_type)
      .eq('object_id', params.object_id)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingPermission) {
      return { success: false, error: 'This permission already exists' }
    }

    // Create permission - RLS handles authorization
    const { data, error } = await supabase
      .from('permissions')
      .insert({
        org_id: params.org_id,
        principal_type: params.principal_type,
        principal_id: params.principal_id,
        role_id: params.role_id,
        object_type: params.object_type,
        object_id: params.object_id,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating permission:', error)
      return { success: false, error: handleRLSError(error) }
    }

    revalidatePath('/settings')
    revalidatePath(`/organization/${params.org_id}/settings`)

    return { success: true, permission: data }
  } catch (error) {
    console.error('Unexpected error assigning role:', error)
    return { success: false, error: handleRLSError(error) }
  }
}

// =====================================================
// REVOKE ROLE
// =====================================================

export async function revokeRole(permission_id: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Soft delete the permission
    const { error } = await supabase
      .from('permissions')
      .update({
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', permission_id)
      .is('deleted_at', null)

    if (error) {
      console.error('Error revoking role:', error)
      return { success: false, error: 'Failed to revoke role' }
    }

    // Revalidate relevant paths
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error revoking role:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// GET OBJECT PERMISSIONS
// =====================================================

export async function getObjectPermissions(
  object_type: ObjectType,
  object_id: string
): Promise<{
  success: boolean
  permissions?: PermissionWithDetails[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch permissions with role and user details
    const { data, error } = await supabase
      .from('permissions')
      .select(`
        *,
        role:roles(*)
      `)
      .eq('object_type', object_type)
      .eq('object_id', object_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching permissions:', error)
      return { success: false, error: 'Failed to fetch permissions' }
    }

    // Fetch user details for user principals
    const userIds = data
      ?.filter(p => p.principal_type === 'user')
      .map(p => p.principal_id) || []

    let userDetails: { [key: string]: { email: string; name?: string } } = {}

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, raw_user_meta_data')
        .in('id', userIds)

      if (users) {
        userDetails = users.reduce((acc, u) => {
          acc[u.id] = {
            email: u.email,
            name: u.raw_user_meta_data?.name || u.raw_user_meta_data?.full_name
          }
          return acc
        }, {} as { [key: string]: { email: string; name?: string } })
      }
    }

    // Combine permission data with user details
    const permissionsWithDetails: PermissionWithDetails[] = data.map(p => ({
      ...p,
      user_email: p.principal_type === 'user' ? userDetails[p.principal_id]?.email : undefined,
      user_name: p.principal_type === 'user' ? userDetails[p.principal_id]?.name : undefined,
    }))

    return { success: true, permissions: permissionsWithDetails }
  } catch (error) {
    console.error('Unexpected error fetching permissions:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// GET ALL ORGANIZATION PERMISSIONS
// =====================================================

export async function getAllOrgPermissions(org_id: string): Promise<{
  success: boolean
  permissions?: PermissionWithDetails[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch ALL permissions for this organization (any object type)
    const { data, error } = await supabase
      .from('permissions')
      .select(`
        *,
        role:roles(*)
      `)
      .eq('org_id', org_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching permissions:', error)
      return { success: false, error: 'Failed to fetch permissions' }
    }

    // Fetch user details for user principals
    const userIds = data
      ?.filter(p => p.principal_type === 'user')
      .map(p => p.principal_id) || []

    let userDetails: { [key: string]: { email: string; name?: string } } = {}

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, raw_user_meta_data')
        .in('id', userIds)

      if (users) {
        userDetails = users.reduce((acc, u) => {
          acc[u.id] = {
            email: u.email,
            name: u.raw_user_meta_data?.name || u.raw_user_meta_data?.full_name
          }
          return acc
        }, {} as { [key: string]: { email: string; name?: string } })
      }
    }

    // Combine permission data with user details
    const permissionsWithDetails: PermissionWithDetails[] = data.map(p => ({
      ...p,
      user_email: p.principal_type === 'user' ? userDetails[p.principal_id]?.email : undefined,
      user_name: p.principal_type === 'user' ? userDetails[p.principal_id]?.name : undefined,
    }))

    return { success: true, permissions: permissionsWithDetails }
  } catch (error) {
    console.error('Unexpected error fetching permissions:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// GET ORGANIZATION MEMBERS
// =====================================================

export async function getOrgMembers(org_id: string): Promise<{
  success: boolean
  members?: Array<{
    org_id: string
    user_id: string
    role_id: string
    role_name: string
    email?: string
    name?: string
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch organization members from materialized view
    const { data: members, error } = await supabase
      .from('organization_members_view')
      .select('*')
      .eq('org_id', org_id)

    if (error) {
      console.error('Error fetching organization members:', error)
      return { success: false, error: 'Failed to fetch organization members' }
    }

    if (!members || members.length === 0) {
      return { success: true, members: [] }
    }

    // Fetch user details from users table
    const userIds = members.map(m => m.user_id)
    const { data: users } = await supabase
      .from('users')
      .select('id, email, raw_user_meta_data')
      .in('id', userIds)

    // Create a map of user details
    let userDetailsMap: { [key: string]: { email: string; name?: string } } = {}
    if (users) {
      userDetailsMap = users.reduce((acc, u) => {
        acc[u.id] = {
          email: u.email,
          name: u.raw_user_meta_data?.name || u.raw_user_meta_data?.full_name
        }
        return acc
      }, {} as { [key: string]: { email: string; name?: string } })
    }

    // Combine member data with user details
    const membersWithDetails = members.map(m => ({
      ...m,
      email: userDetailsMap[m.user_id]?.email,
      name: userDetailsMap[m.user_id]?.name
    }))

    return { success: true, members: membersWithDetails }
  } catch (error) {
    console.error('Unexpected error fetching organization members:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// GET WORKSPACE MEMBERS
// =====================================================

export async function getWorkspaceMembers(workspace_id: string): Promise<{
  success: boolean
  members?: WorkspaceMemberView[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch workspace members from materialized view
    const { data, error } = await supabase
      .from('workspace_members_view')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('user_id', { ascending: true })

    if (error) {
      console.error('Error fetching workspace members:', error)
      return { success: false, error: 'Failed to fetch workspace members' }
    }

    return { success: true, members: data || [] }
  } catch (error) {
    console.error('Unexpected error fetching workspace members:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// CHECK PERMISSION
// =====================================================

export async function checkPermission(params: CheckPermissionParams): Promise<{
  success: boolean
  hasPermission?: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get user's permissions for this object
    const { data: permissions, error: permError } = await supabase
      .from('permissions')
      .select(`
        *,
        role:roles(*)
      `)
      .eq('principal_type', 'user')
      .eq('principal_id', params.user_id)
      .eq('object_type', params.object_type)
      .eq('object_id', params.object_id)
      .is('deleted_at', null)

    if (permError) {
      console.error('Error checking permission:', permError)
      return { success: false, error: 'Failed to check permission' }
    }

    // Check if any role includes the requested action
    const hasPermission = permissions?.some(p => {
      const role = p.role as unknown as Role
      return role?.permissions?.includes(params.action)
    }) || false

    return { success: true, hasPermission }
  } catch (error) {
    console.error('Unexpected error checking permission:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// GET ALL ROLES
// =====================================================

export async function getAllRoles(): Promise<{
  success: boolean
  roles?: Role[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch all active roles (system-wide and org-specific)
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching roles:', error)
      return { success: false, error: 'Failed to fetch roles' }
    }

    return { success: true, roles: data || [] }
  } catch (error) {
    console.error('Unexpected error fetching roles:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// GET USER ORGANIZATIONS
// =====================================================

export async function getUserOrganizations(): Promise<{
  success: boolean
  organizations?: Array<{ id: string; name: string }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get organizations where user has owner/admin role
    const { data: orgMemberships } = await supabase
      .from('organization_members_view')
      .select('org_id')
      .eq('user_id', user.id)

    if (!orgMemberships || orgMemberships.length === 0) {
      return { success: true, organizations: [] }
    }

    const orgIds = orgMemberships.map(m => m.org_id)

    // Fetch organization details
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .in('id', orgIds)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching organizations:', error)
      return { success: false, error: 'Failed to fetch organizations' }
    }

    return { success: true, organizations: data || [] }
  } catch (error) {
    console.error('Unexpected error fetching organizations:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// GET ORGANIZATION WORKSPACES
// =====================================================

export async function getOrganizationWorkspaces(org_id: string): Promise<{
  success: boolean
  workspaces?: Array<{ id: string; name: string }>
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch workspaces for the organization
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name')
      .eq('organization_id', org_id)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching workspaces:', error)
      return { success: false, error: 'Failed to fetch workspaces' }
    }

    return { success: true, workspaces: data || [] }
  } catch (error) {
    console.error('Unexpected error fetching workspaces:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

// =====================================================
// ROLE MANAGEMENT
// =====================================================

export async function createRole(data: CreateRoleInput): Promise<{
  success: boolean
  role?: Role
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Create role - RLS handles authorization
    const roleService = new RoleService(supabase)
    const result = await roleService.createRole(data)

    if (result.success) {
      revalidatePath('/settings')
      revalidatePath(`/organization/${data.org_id}/settings`)
      return result
    }

    return { success: false, error: handleRLSError(result.error) }
  } catch (error) {
    console.error('Unexpected error creating role:', error)
    return { success: false, error: handleRLSError(error) }
  }
}

export async function updateRole(id: string, data: UpdateRoleInput): Promise<{
  success: boolean
  role?: Role
  error?: string
}> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get role org_id for path revalidation
    const { data: role } = await supabase
      .from('roles')
      .select('org_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    // Update role - RLS handles authorization
    const roleService = new RoleService(supabase)
    const result = await roleService.updateRole(id, data)

    if (result.success && role?.org_id) {
      revalidatePath('/settings')
      revalidatePath(`/organization/${role.org_id}/settings`)
      return result
    }

    if (!result.success) {
      return { success: false, error: handleRLSError(result.error) }
    }

    return result
  } catch (error) {
    console.error('Unexpected error updating role:', error)
    return { success: false, error: handleRLSError(error) }
  }
}

export async function deleteRole(id: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get role org_id for path revalidation
    const { data: role } = await supabase
      .from('roles')
      .select('org_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    // Check if role is in use (business logic constraint, not authorization)
    const { data: permissionsCheck, error: checkError } = await supabase
      .from('permissions')
      .select('id')
      .eq('role_id', id)
      .is('deleted_at', null)
      .limit(1)

    if (checkError) {
      return { success: false, error: handleRLSError(checkError) }
    }

    if (permissionsCheck && permissionsCheck.length > 0) {
      return { success: false, error: 'Cannot delete role that is currently assigned to users' }
    }

    // Delete role - RLS handles authorization
    const roleService = new RoleService(supabase)
    const result = await roleService.deleteRole(id)

    if (result.success && role?.org_id) {
      revalidatePath('/settings')
      revalidatePath(`/organization/${role.org_id}/settings`)
      return result
    }

    if (!result.success) {
      return { success: false, error: handleRLSError(result.error) }
    }

    return result
  } catch (error) {
    return { success: false, error: handleRLSError(error) }
  }
}
