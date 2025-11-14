/**
 * Investigate user provisioning issue
 * Shows user metadata, organizations, workspaces, and memberships
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const envContent = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8')
const env: Record<string, string> = {}
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=')
  if (key && values.length) env[key.trim()] = values.join('=').trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const EMAIL = process.argv[2]

if (!EMAIL) {
  console.error('Usage: npx tsx scripts/investigate-user.ts <email>')
  process.exit(1)
}

async function investigateUser() {
  console.log(`🔍 Investigating user: ${EMAIL}\n`)

  // Get user with metadata
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === EMAIL)

  if (!user) {
    console.error(`❌ User not found: ${EMAIL}`)
    process.exit(1)
  }

  console.log(`✅ User ID: ${user.id}`)
  console.log(`📅 Created at: ${user.created_at}`)
  console.log(`📧 Email confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}`)
  console.log(`\n📋 User Metadata:`)
  console.log(JSON.stringify(user.raw_user_meta_data, null, 2))
  console.log(`\n📋 App Metadata:`)
  console.log(JSON.stringify(user.raw_app_meta_data, null, 2))

  // Check organizations created by this user
  const { data: ownedOrgs } = await supabase
    .from('organizations')
    .select('id, name, created_at')
    .eq('created_by', user.id)
    .is('deleted_at', null)

  console.log(`\n🏢 Organizations created by user: ${ownedOrgs?.length || 0}`)
  if (ownedOrgs && ownedOrgs.length > 0) {
    ownedOrgs.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`)
      console.log(`    Created: ${org.created_at}`)
    })
  }

  // Check organization memberships
  const { data: memberships } = await supabase
    .from('organization_members')
    .select(`
      org_id,
      created_at,
      organization:org_id(id, name, created_by)
    `)
    .eq('user_id', user.id)
    .is('deleted_at', null)

  console.log(`\n👥 Organization memberships: ${memberships?.length || 0}`)
  if (memberships && memberships.length > 0) {
    for (const membership of memberships) {
      const org = membership.organization as any
      console.log(`  - ${org.name} (${org.id})`)
      console.log(`    Member since: ${membership.created_at}`)
      console.log(`    Is owner: ${org.created_by === user.id ? 'Yes' : 'No'}`)
    }
  }

  // Check workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select(`
      id,
      name,
      organization_id,
      created_by,
      created_at,
      organization:organization_id(name)
    `)
    .eq('created_by', user.id)
    .is('deleted_at', null)

  console.log(`\n💼 Workspaces created by user: ${workspaces?.length || 0}`)
  if (workspaces && workspaces.length > 0) {
    workspaces.forEach(ws => {
      const org = ws.organization as any
      console.log(`  - ${ws.name} (${ws.id})`)
      console.log(`    Organization: ${org.name}`)
      console.log(`    Created: ${ws.created_at}`)
    })
  }

  // Check role assignments
  const { data: roleAssignments } = await supabase
    .from('principal_role_assignments')
    .select(`
      id,
      org_id,
      workspace_id,
      role_id,
      created_at,
      role:role_id(name),
      organization:org_id(name),
      workspace:workspace_id(name)
    `)
    .eq('principal_id', user.id)
    .eq('principal_kind', 'user')
    .is('deleted_at', null)

  console.log(`\n🎭 Role assignments: ${roleAssignments?.length || 0}`)
  if (roleAssignments && roleAssignments.length > 0) {
    roleAssignments.forEach(ra => {
      const role = ra.role as any
      const org = ra.organization as any
      const workspace = ra.workspace as any
      console.log(`  - ${role.name}`)
      console.log(`    Organization: ${org.name}`)
      console.log(`    Workspace: ${workspace?.name || 'N/A'}`)
      console.log(`    Assigned: ${ra.created_at}`)
    })
  }

  console.log(`\n`)
}

investigateUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Error:', err)
    process.exit(1)
  })
