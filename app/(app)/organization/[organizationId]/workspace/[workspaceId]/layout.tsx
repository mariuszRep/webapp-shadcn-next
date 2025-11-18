import { notFound, redirect } from 'next/navigation'
import { ReactNode } from 'react'
import { OrganizationWorkspaceProvider } from '@/components/providers/organization-workspace-provider'
import { createClient } from '@/lib/supabase/server'
import { getOrganization, getWorkspace } from '@/lib/actions/workspace'

interface WorkspaceLayoutProps {
  children: ReactNode
  params: Promise<{
    organizationId: string
    workspaceId: string
  }>
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { organizationId, workspaceId } = await params

  // Validate UUID formats
  if (!UUID_REGEX.test(organizationId) || !UUID_REGEX.test(workspaceId)) {
    notFound()
  }

  // Get current user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch organization and workspace data with access validation
  const organization = await getOrganization(organizationId, user.id)
  const workspace = await getWorkspace(workspaceId, organizationId, user.id)

  return (
    <OrganizationWorkspaceProvider
      organization={organization}
      workspace={workspace}
    >
      {children}
    </OrganizationWorkspaceProvider>
  )
}
