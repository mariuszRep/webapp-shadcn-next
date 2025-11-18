import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Role, PermissionAction } from '@/lib/types/database'

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

export class RoleService {
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
