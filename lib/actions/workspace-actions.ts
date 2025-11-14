'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Workspace } from '@/lib/types/database'
import { requirePermission } from '@/lib/utils/permissions'

export async function createWorkspace(organizationId: string, name: string): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate workspace name
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Workspace name is required' }
    }

    if (name.trim().length > 100) {
      return { success: false, error: 'Workspace name is too long' }
    }

    // Check permission to create workspace
    await requirePermission('workspace', 'create', organizationId)

    // Create workspace (RLS enforces permissions)
    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        name: name.trim(),
        organization_id: organizationId,
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating workspace:', error)
      return { success: false, error: 'Failed to create workspace' }
    }

    // Revalidate the path to refresh data
    revalidatePath(`/organization/${organizationId}`)

    return { success: true, workspace: data }
  } catch (error) {
    console.error('Unexpected error creating workspace:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getOrganizationWorkspaces(organizationId: string): Promise<{ success: boolean; workspaces?: Workspace[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch workspaces for the organization where user has access (RLS enforces permissions)
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })

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

export async function updateWorkspace(workspaceId: string, name: string): Promise<{ success: boolean; workspace?: Workspace; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate workspace name
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Workspace name is required' }
    }

    if (name.trim().length > 100) {
      return { success: false, error: 'Workspace name is too long' }
    }

    // Fetch workspace to get organization_id for permission check
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('organization_id')
      .eq('id', workspaceId)
      .single()

    if (fetchError || !workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    // Check permission to update workspace
    await requirePermission('workspace', 'update', workspace.organization_id, workspaceId)

    // Update workspace (RLS enforces permissions)
    const { data, error } = await supabase
      .from('workspaces')
      .update({
        name: name.trim(),
        updated_by: user.id,
      })
      .eq('id', workspaceId)
      .select()
      .single()

    if (error) {
      console.error('Error updating workspace:', error)
      return { success: false, error: 'Failed to update workspace' }
    }

    // Revalidate path
    revalidatePath('/settings')

    return { success: true, workspace: data }
  } catch (error) {
    console.error('Unexpected error updating workspace:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch workspace to check name and get organization_id
    const { data: workspace, error: fetchError } = await supabase
      .from('workspaces')
      .select('name, organization_id')
      .eq('id', workspaceId)
      .single()

    if (fetchError || !workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    if (workspace.name === 'Personal') {
      return { success: false, error: 'Cannot delete personal workspace' }
    }

    // Check permission to delete workspace
    await requirePermission('workspace', 'delete', workspace.organization_id, workspaceId)

    // Delete workspace (RLS enforces permissions)
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)

    if (error) {
      console.error('Error deleting workspace:', error)
      return { success: false, error: 'Failed to delete workspace' }
    }

    // Revalidate path
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting workspace:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}
