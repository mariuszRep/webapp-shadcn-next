import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPersonalWorkspace } from '@/lib/data/workspace'

export default async function PortalRedirectPage() {
  // Get current user
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's personal organization and workspace
  const { organizationId, workspaceId } = await getPersonalWorkspace(user.id)

  // Redirect to personal workspace portal
  redirect(`/organization/${organizationId}/workspace/${workspaceId}/portal`)
}
