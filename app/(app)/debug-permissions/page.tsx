import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DebugPermissionsPage() {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Get all permissions
  const { data: permissions } = await supabase
    .from('permissions')
    .select(`
      *,
      role:roles(*)
    `)
    .is('deleted_at', null)

  // Get all roles
  const { data: roles } = await supabase
    .from('roles')
    .select('*')
    .is('deleted_at', null)

  // Get organization members view
  const { data: orgMembers } = await supabase
    .from('organization_members_view')
    .select('*')

  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-bold">Debug Permissions</h1>

      <div>
        <h2 className="text-xl font-semibold mb-2">Current User</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify({ id: user.id, email: user.email }, null, 2)}
        </pre>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Roles Table</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(roles, null, 2)}
        </pre>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Permissions Table</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(permissions, null, 2)}
        </pre>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Organization Members View</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(orgMembers, null, 2)}
        </pre>
      </div>
    </div>
  )
}
