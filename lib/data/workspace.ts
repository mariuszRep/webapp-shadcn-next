import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import type { Organization, Workspace } from '@/lib/types/database'

// Cache the organization fetch to deduplicate across Server Components
export const getOrganization = cache(async (organizationId: string, userId: string): Promise<Organization> => {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', organizationId)
    .single()

  if (error || !data) {
    notFound()
  }

  // Validate user has access (created by or updated by)
  if (data.created_by !== userId && data.updated_by !== userId) {
    notFound()
  }

  return data
})

// Cache the workspace fetch to deduplicate across Server Components
export const getWorkspace = cache(async (workspaceId: string, organizationId: string, userId: string): Promise<Workspace> => {
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

  // Validate user has access
  if (data.created_by !== userId && data.updated_by !== userId) {
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
export async function getFirstWorkspaceForOrg(organizationId: string, userId: string): Promise<string> {
  const supabase = await createClient()

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', organizationId)
    .or(`created_by.eq.${userId},updated_by.eq.${userId}`)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !workspace) {
    throw new Error('No workspace found for this organization')
  }

  return workspace.id
}
