import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  ObjectType,
  UsersPermissionsView
} from '@/lib/types/database'

/**
 * Shared service for permission queries
 * Encapsulates logic for querying the users_permissions materialized view
 */
export class PermissionsService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Get users with permissions for a specific organization
   */
  async getOrganizationMembers(orgId: string): Promise<UsersPermissionsView[]> {
    const { data, error } = await this.supabase
      .from('users_permissions')
      .select('*')
      .eq('org_id', orgId)
      .eq('object_type', 'organization')

    if (error) {
      throw new Error(`Failed to fetch organization members: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get users with permissions for a specific workspace
   */
  async getWorkspaceMembers(workspaceId: string): Promise<UsersPermissionsView[]> {
    const { data, error } = await this.supabase
      .from('users_permissions')
      .select('*')
      .eq('object_id', workspaceId)
      .eq('object_type', 'workspace')
      .order('user_id', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch workspace members: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get all objects of a specific type that a user has access to
   */
  async getUserObjects(objectType: ObjectType): Promise<UsersPermissionsView[]> {
    const { data, error } = await this.supabase
      .from('users_permissions')
      .select('*')
      .eq('object_type', objectType)

    if (error) {
      throw new Error(`Failed to fetch user ${objectType}s: ${error.message}`)
    }

    return data || []
  }

  /**
   * Get all organizations a user belongs to
   */
  async getUserOrganizations(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('users_permissions')
      .select('object_id')
      .eq('object_type', 'organization')

    if (error) {
      throw new Error(`Failed to fetch user organizations: ${error.message}`)
    }

    return data?.map(d => d.object_id!).filter(Boolean) || []
  }

  /**
   * Check if a user has a specific role on an object
   */
  async hasRole(
    objectType: ObjectType,
    objectId: string,
    roleName: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('users_permissions')
      .select('role_name')
      .eq('object_type', objectType)
      .eq('object_id', objectId)
      .eq('role_name', roleName)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to check user role: ${error.message}`)
    }

    return !!data
  }

  /**
   * Get user's role permissions for a specific object
   */
  async getUserRolePermissions(
    objectType: ObjectType,
    objectId: string
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('users_permissions')
      .select('role_permissions')
      .eq('object_type', objectType)
      .eq('object_id', objectId)

    if (error) {
      throw new Error(`Failed to fetch user role permissions: ${error.message}`)
    }

    // Combine all permissions from all roles the user has on this object
    const allPermissions = data
      ?.flatMap(d => d.role_permissions as string[] || [])
      || []

    // Return unique permissions
    return Array.from(new Set(allPermissions))
  }
}
