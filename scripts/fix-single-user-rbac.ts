/**
 * Fix RBAC for a single user
 * Assigns missing role assignments for their Personal org/workspace
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
  console.error('Usage: npx tsx scripts/fix-single-user-rbac.ts <email>')
  process.exit(1)
}

async function fixUser() {
  console.log(`🔧 Fixing RBAC for: ${EMAIL}\n`)

  // Get user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === EMAIL)

  if (!user) {
    console.error(`❌ User not found: ${EMAIL}`)
    process.exit(1)
  }

  console.log(`✅ User ID: ${user.id}\n`)

  // Get roles
  const { data: orgOwnerRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'org_owner')
    .is('deleted_at', null)
    .single()

  const { data: workspaceOwnerRole } = await supabase
    .from('roles')
    .select('id')
    .eq('name', 'workspace_owner')
    .is('deleted_at', null)
    .single()

  if (!orgOwnerRole || !workspaceOwnerRole) {
    throw new Error('Required roles not found')
  }

  // Find user's Personal organization
  const { data: personalOrg } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('created_by', user.id)
    .eq('name', 'Personal')
    .is('deleted_at', null)
    .single()

  if (!personalOrg) {
    console.error('❌ No Personal organization found for this user')
    process.exit(1)
  }

  console.log(`✅ Personal Organization: ${personalOrg.id}`)

  // Find Personal workspace
  const { data: personalWorkspace } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('organization_id', personalOrg.id)
    .eq('name', 'Personal')
    .is('deleted_at', null)
    .single()

  if (!personalWorkspace) {
    console.error('❌ No Personal workspace found')
    process.exit(1)
  }

  console.log(`✅ Personal Workspace: ${personalWorkspace.id}\n`)

  // Add to organization_members if not already
  const { error: memberError } = await supabase
    .from('organization_members')
    .insert({
      org_id: personalOrg.id,
      user_id: user.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (memberError && memberError.code !== '23505') {
    console.error(`⚠️  Failed to add to organization_members: ${memberError.message}`)
  } else if (!memberError) {
    console.log(`✅ Added to organization_members`)
  } else {
    console.log(`ℹ️  Already in organization_members`)
  }

  // Assign org_owner role
  const { error: orgRoleError } = await supabase
    .from('principal_role_assignments')
    .insert({
      principal_kind: 'user',
      principal_id: user.id,
      org_id: personalOrg.id,
      workspace_id: null,
      role_id: orgOwnerRole.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (orgRoleError && orgRoleError.code !== '23505') {
    console.error(`⚠️  Failed to assign org_owner: ${orgRoleError.message}`)
  } else if (!orgRoleError) {
    console.log(`✅ Assigned org_owner role`)
  } else {
    console.log(`ℹ️  Already has org_owner role`)
  }

  // Assign workspace_owner role
  const { error: wsRoleError } = await supabase
    .from('principal_role_assignments')
    .insert({
      principal_kind: 'user',
      principal_id: user.id,
      org_id: personalOrg.id,
      workspace_id: personalWorkspace.id,
      role_id: workspaceOwnerRole.id,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single()

  if (wsRoleError && wsRoleError.code !== '23505') {
    console.error(`⚠️  Failed to assign workspace_owner: ${wsRoleError.message}`)
  } else if (!wsRoleError) {
    console.log(`✅ Assigned workspace_owner role`)
  } else {
    console.log(`ℹ️  Already has workspace_owner role`)
  }

  console.log(`\n🎉 User RBAC fixed!`)
}

fixUser()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌ Error:', err)
    process.exit(1)
  })
