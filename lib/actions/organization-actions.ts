'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Organization } from '@/lib/types/database'
import { getFirstWorkspaceForOrg } from '@/lib/data/workspace'

export async function createOrganization(name: string): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate organization name
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Organization name is required' }
    }

    if (name.trim().length > 100) {
      return { success: false, error: 'Organization name is too long' }
    }

    // Create organization
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: name.trim(),
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating organization:', error)
      return { success: false, error: 'Failed to create organization' }
    }

    // Revalidate settings pages
    revalidatePath('/settings')
    if (data?.id) {
      revalidatePath(`/organization/${data.id}/settings`)
    }

    return { success: true, organization: data }
  } catch (error) {
    console.error('Unexpected error creating organization:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getUserOrganizations(): Promise<{ success: boolean; organizations?: Organization[]; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch organizations (RLS will handle permission filtering)
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: true })

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

export async function updateOrganization(organizationId: string, name: string): Promise<{ success: boolean; organization?: Organization; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Validate organization name
    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Organization name is required' }
    }

    if (name.trim().length > 100) {
      return { success: false, error: 'Organization name is too long' }
    }

    // Update organization (RLS will handle permission checking)
    const { data, error } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        updated_by: user.id,
      })
      .eq('id', organizationId)
      .select()
      .single()

    if (error) {
      console.error('Error updating organization:', error)
      return { success: false, error: 'Failed to update organization' }
    }

    // Revalidate settings pages
    revalidatePath('/settings')
    revalidatePath(`/organization/${organizationId}/settings`)

    return { success: true, organization: data }
  } catch (error) {
    console.error('Unexpected error updating organization:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function deleteOrganization(organizationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if this is the user's only organization
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id')
      .eq('created_by', user.id)

    if (orgs && orgs.length === 1 && orgs[0].id === organizationId) {
      return { success: false, error: 'Cannot delete your only organization' }
    }

    // Delete organization (RLS will handle permission checking)
    const { error } = await supabase
      .from('organizations')
      .delete()
      .eq('id', organizationId)

    if (error) {
      console.error('Error deleting organization:', error)
      return { success: false, error: 'Failed to delete organization' }
    }

    // Revalidate settings pages
    revalidatePath('/settings')
    revalidatePath(`/organization/${organizationId}/settings`)

    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting organization:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function getOrganizationDefaultWorkspace(organizationId: string): Promise<{ success: boolean; workspaceId?: string; error?: string }> {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Unauthorized' }
    }

    const workspaceId = await getFirstWorkspaceForOrg(organizationId, user.id)

    return { success: true, workspaceId }
  } catch (error) {
    console.error('Unexpected error getting workspace:', error)
    return { success: false, error: 'No workspace found for this organization' }
  }
}
