import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InvitationForm } from '@/components/invitation-form'

interface NewInvitationPageProps {
  params: Promise<{ organizationId: string }>
}

export default async function NewInvitationPage({ params }: NewInvitationPageProps) {
  const { organizationId } = await params
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch organization details
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', organizationId)
    .single()

  if (orgError || !organization) {
    redirect(`/organization/${organizationId}/settings`)
  }

  // Fetch available roles (system roles)
  const { data: roles, error: rolesError } = await supabase
    .from('roles')
    .select('id, name, description')
    .is('org_id', null)
    .order('name', { ascending: true })

  if (rolesError) {
    redirect(`/organization/${organizationId}/settings`)
  }

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invite User</h1>
        <p className="text-muted-foreground mt-2">
          Send an invitation to join {organization.name}
        </p>
      </div>

      <InvitationForm
        organizationId={organizationId}
        organizationName={organization.name}
        roles={roles || []}
      />
    </div>
  )
}
