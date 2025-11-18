'use server'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import type { Organization, Workspace } from '@/lib/types/database'

// =====================================================
// CACHE FUNCTIONS FOR SERVER COMPONENTS
// =====================================================

// Cache the organization fetch to deduplicate across Server Components
export const getOrganization = cache(async (organizationId: string): Promise<Organization> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single()

  if (error || !data) {
    notFound()
  }

  return data
})

// Cache the workspace fetch to deduplicate across Server Components
export const getWorkspace = cache(async (workspaceId: string, organizationId: string): Promise<Workspace> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .eq('organization_id', organizationId)
    .single()

  if (error || !data) {
    notFound()
  }

  return data
})

// Get user's personal organization and workspace for redirect
export const getPersonalWorkspace = cache(async (userId: string): Promise<{ organizationId: string; workspaceId: string }> => {
  const supabase = await createClient()

  // Find personal organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id')
    .eq('created_by', userId)
    .eq('name', 'Personal')
    .single()

  if (orgError || !org) {
    throw new Error('Personal organization not found')
  }

  // Find personal workspace
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', org.id)
    .eq('name', 'Personal')
    .single()

  if (workspaceError || !workspace) {
    throw new Error('Personal workspace not found')
  }

  return {
    organizationId: org.id,
    workspaceId: workspace.id,
  }
})

// Get first workspace for an organization
export async function getFirstWorkspaceForOrg(organizationId: string): Promise<string> {
  const supabase = await createClient()

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !workspace) {
    throw new Error('No workspace found for this organization')
  }

  return workspace.id
}

// =====================================================
// WORKSPACE CRUD ACTIONS
// =====================================================

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

    // Fetch workspaces for the organization (RLS will handle permission filtering)
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

    // Update workspace (RLS will handle permission checking)
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

    // Check if this is a personal workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single()

    if (workspace && workspace.name === 'Personal') {
      return { success: false, error: 'Cannot delete personal workspace' }
    }

    // Delete workspace (RLS will handle permission checking)
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
