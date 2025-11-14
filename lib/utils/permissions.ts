import { createClient } from '@/lib/supabase/server'
import type { ResourceKind } from '@/lib/types/rbac'

/**
 * Check if the current user has a specific permission
 * Calls the has_permission PostgreSQL function via RPC
 */
export async function hasPermission(
  resource: ResourceKind,
  action: string,
  orgId: string,
  workspaceId?: string | null,
  entityTypeId?: string | null
): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('has_permission', {
      _resource: resource,
      _action: action,
      _org_id: orgId,
      _workspace_id: workspaceId || null,
      _entity_type_id: entityTypeId || null,
    })

    if (error) {
      console.error('Permission check error:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('Unexpected error checking permission:', error)
    return false
  }
}

/**
 * Require a specific permission, throw error if not granted
 * Use in server actions to enforce permissions
 */
export async function requirePermission(
  resource: ResourceKind,
  action: string,
  orgId: string,
  workspaceId?: string | null,
  entityTypeId?: string | null
): Promise<void> {
  const hasAccess = await hasPermission(resource, action, orgId, workspaceId, entityTypeId)

  if (!hasAccess) {
    throw new Error(
      `Permission denied: ${action} on ${resource}${workspaceId ? ` (workspace: ${workspaceId})` : ''}`
    )
  }
}

/**
 * Check if the current user is a member of an organization
 * Calls the is_org_member PostgreSQL function via RPC
 */
export async function isOrgMember(orgId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc('is_org_member', {
      _org_id: orgId,
    })

    if (error) {
      console.error('Organization membership check error:', error)
      return false
    }

    return data === true
  } catch (error) {
    console.error('Unexpected error checking organization membership:', error)
    return false
  }
}
