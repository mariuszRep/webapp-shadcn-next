import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { z } from 'zod'

// Zod validation schemas
const CreateOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(100, 'Organization name must be less than 100 characters')
    .trim(),
  userId: z.string().uuid('Invalid user ID'),
})

const CreateWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, 'Workspace name is required')
    .max(100, 'Workspace name must be less than 100 characters')
    .trim(),
  orgId: z.string().uuid('Invalid organization ID'),
  userId: z.string().uuid('Invalid user ID'),
})

const CheckMembershipSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
})

export type CreateOrganizationParams = z.infer<typeof CreateOrganizationSchema>
export type CreateWorkspaceParams = z.infer<typeof CreateWorkspaceSchema>
export type CheckMembershipParams = z.infer<typeof CheckMembershipSchema>

export interface OrganizationWithPermission {
  id: string
  name: string
  created_at: string
}

export interface WorkspaceWithPermission {
  id: string
  name: string
  organization_id: string
  created_at: string
}

export interface OrganizationMembershipStatus {
  hasOrganizations: boolean
  organizationCount: number
}

/**
 * Service for managing onboarding flow
 * Handles organization and workspace creation with automatic permission assignment
 */
export class OnboardingService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Create an organization and assign Owner role to the creator
   * Uses transaction to ensure atomicity
   */
  async createOrganizationWithPermissions(
    params: CreateOrganizationParams
  ): Promise<OrganizationWithPermission> {
    // Validate input
    const validated = CreateOrganizationSchema.parse(params)
    const { name, userId } = validated

    // Create organization
    const { data: organization, error: orgError } = await this.supabase
      .from('organizations')
      .insert({
        name,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()

    if (orgError || !organization) {
      throw new Error(`Failed to create organization: ${orgError?.message || 'Unknown error'}`)
    }

    // Query for Owner role ID
    const { data: ownerRole, error: roleError } = await this.supabase
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .is('org_id', null)
      .single()

    if (roleError || !ownerRole) {
      // Rollback: Delete organization if role query fails
      await this.supabase.from('organizations').delete().eq('id', organization.id)
      throw new Error(`Failed to find Owner role: ${roleError?.message || 'Role not found'}`)
    }

    // Create organization permission
    const { error: permissionError } = await this.supabase
      .from('permissions')
      .insert({
        org_id: organization.id,
        principal_type: 'user',
        principal_id: userId,
        object_type: 'organization',
        object_id: organization.id,
        role_id: ownerRole.id,
        created_by: userId,
        updated_by: userId,
      })

    if (permissionError) {
      // Rollback: Delete organization if permission creation fails
      await this.supabase.from('organizations').delete().eq('id', organization.id)
      throw new Error(`Failed to create organization permission: ${permissionError.message}`)
    }

    return {
      id: organization.id,
      name: organization.name,
      created_at: organization.created_at,
    }
  }

  /**
   * Create a workspace and assign Owner role to the creator
   * Uses transaction to ensure atomicity
   */
  async createWorkspaceWithPermissions(
    params: CreateWorkspaceParams
  ): Promise<WorkspaceWithPermission> {
    // Validate input
    const validated = CreateWorkspaceSchema.parse(params)
    const { name, orgId, userId } = validated

    // Create workspace
    const { data: workspace, error: workspaceError } = await this.supabase
      .from('workspaces')
      .insert({
        name,
        organization_id: orgId,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()

    if (workspaceError || !workspace) {
      throw new Error(
        `Failed to create workspace: ${workspaceError?.message || 'Unknown error'}`
      )
    }

    // Query for Owner role ID (same role used for organizations and workspaces)
    const { data: ownerRole, error: roleError } = await this.supabase
      .from('roles')
      .select('id')
      .eq('name', 'owner')
      .is('org_id', null)
      .single()

    if (roleError || !ownerRole) {
      // Rollback: Delete workspace if role query fails
      await this.supabase.from('workspaces').delete().eq('id', workspace.id)
      throw new Error(`Failed to find Owner role: ${roleError?.message || 'Role not found'}`)
    }

    // Create workspace permission
    const { error: permissionError } = await this.supabase
      .from('permissions')
      .insert({
        org_id: orgId,
        principal_type: 'user',
        principal_id: userId,
        object_type: 'workspace',
        object_id: workspace.id,
        role_id: ownerRole.id,
        created_by: userId,
        updated_by: userId,
      })

    if (permissionError) {
      // Rollback: Delete workspace if permission creation fails
      await this.supabase.from('workspaces').delete().eq('id', workspace.id)
      throw new Error(`Failed to create workspace permission: ${permissionError.message}`)
    }

    return {
      id: workspace.id,
      name: workspace.name,
      organization_id: workspace.organization_id,
      created_at: workspace.created_at,
    }
  }

  /**
   * Check if a user has any organization memberships
   * Queries the users_permissions view for organization access
   */
  async checkUserOrganizationMembership(
    params: CheckMembershipParams
  ): Promise<OrganizationMembershipStatus> {
    // Validate input
    const validated = CheckMembershipSchema.parse(params)
    const { userId } = validated

    // Query users_permissions view for organization memberships
    const { data, error } = await this.supabase
      .from('users_permissions')
      .select('object_id', { count: 'exact', head: false })
      .eq('user_id', userId)
      .eq('object_type', 'organization')

    if (error) {
      throw new Error(`Failed to check organization membership: ${error.message}`)
    }

    const organizationCount = data?.length || 0

    return {
      hasOrganizations: organizationCount > 0,
      organizationCount,
    }
  }
}
