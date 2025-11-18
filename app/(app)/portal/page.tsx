import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getUserOrganizations, getOrganizationDefaultWorkspace } from '@/lib/actions/organization-actions'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Use service layer to get organizations
  const result = await getUserOrganizations()

  if (!result.success || !result.organizations || result.organizations.length === 0) {
    // No organization found - redirect to settings to create one
    redirect('/settings?error=no_organization')
  }

  // Get first organization
  const firstOrg = result.organizations[0]

  // Use service layer to get default workspace for this organization
  const workspaceResult = await getOrganizationDefaultWorkspace(firstOrg.id)

  if (!workspaceResult.success || !workspaceResult.workspaceId) {
    // No workspace found - redirect to organization settings to create one
    redirect(`/organization/${firstOrg.id}/settings?error=no_workspace`)
  }

  // Redirect to the workspace portal
  redirect(`/organization/${firstOrg.id}/workspace/${workspaceResult.workspaceId}`)
}
