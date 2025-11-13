import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPersonalWorkspace } from '@/lib/data/workspace'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { organizationId, workspaceId } = await getPersonalWorkspace(user.id)

  redirect(`/organization/${organizationId}/workspace/${workspaceId}`)
}
