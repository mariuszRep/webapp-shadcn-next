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
    .is('deleted_at', null)
    .single()

  if (error || !data) {
    notFound()
  }

  // Validate user is a member of this organization
  const { data: membership } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('org_id', organizationId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single()

  if (!membership) {
    notFound()
  }

  return data
})

// Cache the workspace fetch to deduplicate across Server Components
export const getWorkspace = cache(async (workspaceId: string, organizationId: string, userId: string): Promise<Workspace> => {
  const supabase = await createClient()

  // Rely on RLS to filter workspaces based on has_permission('workspace', 'read', organization_id, id)
  // RLS validates organization membership and workspace permissions
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

// Get user's first accessible organization and workspace for redirect
export const getPersonalWorkspace = cache(async (userId: string): Promise<{ organizationId: string; workspaceId: string }> => {
  const supabase = await createClient()

  // Find ANY organization the user is a member of (including invited orgs)
  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (memberError || !membership) {
    console.error('Error fetching organization membership:', memberError)
    throw new Error('No organization found for user')
  }

  const organizationId = membership.org_id

  // Find ANY workspace in that organization that the user has access to
  // RLS policies will filter based on has_permission('workspace', 'read', organization_id, id)
  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (workspaceError || !workspace) {
    console.error('Error fetching workspace:', workspaceError)
    throw new Error('No workspace found for user')
  }

  return {
    organizationId,
    workspaceId: workspace.id,
  }
})

// Get first workspace for an organization
export async function getFirstWorkspaceForOrg(organizationId: string, userId: string): Promise<string> {
  const supabase = await createClient()

  // Rely on RLS to filter workspaces based on permissions
  // RLS validates organization membership and workspace permissions
  const { data: workspace, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('organization_id', organizationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !workspace) {
    throw new Error('No workspace found for this organization')
  }

  return workspace.id
}
