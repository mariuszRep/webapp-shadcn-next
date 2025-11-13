'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Workspace } from '@/lib/types/database'

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

    // Create workspace
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

    // Fetch workspaces for the organization where user has access
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('organization_id', organizationId)
      .or(`created_by.eq.${user.id},updated_by.eq.${user.id}`)
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

    // Update workspace
    const { data, error } = await supabase
      .from('workspaces')
      .update({
        name: name.trim(),
        updated_by: user.id,
      })
      .eq('id', workspaceId)
      .or(`created_by.eq.${user.id},updated_by.eq.${user.id}`)
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

    // Check if this is a personal workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    if (workspace && workspace.name === 'Personal') {
      return { success: false, error: 'Cannot delete personal workspace' }
    }

    // Delete workspace
    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)
      .or(`created_by.eq.${user.id},updated_by.eq.${user.id}`)

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
